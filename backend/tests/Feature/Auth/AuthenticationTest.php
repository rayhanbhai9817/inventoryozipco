<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Enums\Role;
use App\Models\Business;
use App\Models\RoleDefinition;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

final class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registering_creates_a_business_its_owner_and_its_role_definitions(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Fast Sold Demo Co',
            'name' => 'Avery Stone',
            'email' => 'avery@example.com',
            'password' => 'Correct-Horse-42',
            'password_confirmation' => 'Correct-Horse-42',
            'terms_accepted' => true,
        ])->assertCreated();

        $response->assertJsonStructure(['message', 'token', 'user' => ['id', 'email', 'role', 'permissions']]);
        $this->assertSame('owner', $response->json('user.role.value'));

        $business = Business::query()->where('name', 'Fast Sold Demo Co')->sole();
        $owner = User::query()->where('email', 'avery@example.com')->sole();

        $this->assertSame($business->id, $owner->business_id);
        $this->assertSame(Role::Owner, $owner->role);
        $this->assertTrue($owner->is_active);

        // Per-business role definitions are provisioned at registration.
        $roles = RoleDefinition::query()
            ->withoutGlobalScopes()
            ->where('business_id', $business->id)
            ->pluck('key')
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['manager', 'owner', 'staff'], $roles);
    }

    public function test_registration_requires_a_confirmed_strong_password(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Weak Co',
            'name' => 'Someone',
            'email' => 'someone@example.com',
            'password' => 'short',
            'password_confirmation' => 'different',
            'terms_accepted' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->assertSame(0, User::query()->count());
    }

    public function test_registration_rejects_a_duplicate_email(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $existing = User::factory()->forBusiness($business)->create(['email' => 'taken@example.com']);

        $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Another Co',
            'name' => 'Someone Else',
            'email' => $existing->email,
            'password' => 'Correct-Horse-42',
            'password_confirmation' => 'Correct-Horse-42',
            'terms_accepted' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_registration_requires_accepting_the_terms(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'business_name' => 'No Terms Co',
            'name' => 'Someone',
            'email' => 'noterms@example.com',
            'password' => 'Correct-Horse-42',
            'password_confirmation' => 'Correct-Horse-42',
        ])->assertUnprocessable()->assertJsonValidationErrors('terms_accepted');
    }

    public function test_a_user_can_sign_in_and_receive_a_token(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $user = User::factory()->owner()->forBusiness($business)->create([
            'email' => 'signin@example.com',
            'password' => Hash::make('Correct-Horse-42'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'signin@example.com',
            'password' => 'Correct-Horse-42',
        ])->assertOk();

        $this->assertNotEmpty($response->json('token'));
        $this->assertSame($user->id, $response->json('user.id'));
        $this->assertNotNull($user->fresh()->last_login_at);
    }

    public function test_sign_in_gives_the_same_message_for_an_unknown_email_and_a_wrong_password(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        User::factory()->forBusiness($business)->create([
            'email' => 'known@example.com',
            'password' => Hash::make('Correct-Horse-42'),
        ]);

        $unknown = $this->postJson('/api/v1/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'Correct-Horse-42',
        ])->assertUnprocessable();

        RateLimiter::clear('nobody@example.com|127.0.0.1');

        $wrongPassword = $this->postJson('/api/v1/auth/login', [
            'email' => 'known@example.com',
            'password' => 'Wrong-Password-99',
        ])->assertUnprocessable();

        // Identical wording, so the endpoint cannot be used to enumerate accounts.
        $this->assertSame(
            $unknown->json('errors.email'),
            $wrongPassword->json('errors.email')
        );
    }

    public function test_sign_in_is_throttled_after_repeated_failures(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        User::factory()->forBusiness($business)->create([
            'email' => 'throttle@example.com',
            'password' => Hash::make('Correct-Horse-42'),
        ]);

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'throttle@example.com',
                'password' => 'Wrong-Password-99',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/login', [
            'email' => 'throttle@example.com',
            'password' => 'Correct-Horse-42',
        ])->assertStatus(429);

        RateLimiter::clear('throttle@example.com|127.0.0.1');
    }

    public function test_a_deactivated_user_cannot_sign_in(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        User::factory()->forBusiness($business)->inactive()->create([
            'email' => 'gone@example.com',
            'password' => Hash::make('Correct-Horse-42'),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'gone@example.com',
            'password' => 'Correct-Horse-42',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');

        RateLimiter::clear('gone@example.com|127.0.0.1');
    }

    public function test_protected_routes_reject_an_unauthenticated_request(): void
    {
        $this->getJson('/api/v1/dashboard')->assertUnauthorized();
        $this->getJson('/api/v1/products')->assertUnauthorized();
        $this->getJson('/api/v1/inventory/ledger')->assertUnauthorized();
    }

    /**
     * A token-bearing caller must get the generous per-token budget, not the
     * tight per-IP one.
     *
     * The throttle middleware runs before `auth:sanctum`, so a limiter written
     * against `$request->user()` sees null and drops every caller into the
     * shared per-IP bucket — which silently capped all authenticated traffic at
     * the anonymous limit and made everyone behind one office IP share it. The
     * headers are asserted because nothing else makes that visible.
     */
    public function test_authenticated_requests_are_throttled_per_token_not_per_ip(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $user = User::factory()->owner()->forBusiness($business)->create([
            'email' => 'budget@example.com',
            'password' => Hash::make('Correct-Horse-42'),
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'budget@example.com',
            'password' => 'Correct-Horse-42',
        ])->json('token');

        // The anonymous call goes first: `withHeader` persists for the rest of
        // the test, so there is no way back to an unauthenticated request after
        // the token has been attached.
        $anonymous = $this->getJson('/api/v1/products')->assertUnauthorized();

        $this->assertSame('40', $anonymous->headers->get('X-RateLimit-Limit'));

        $authenticated = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/products')
            ->assertOk();

        $this->assertSame('180', $authenticated->headers->get('X-RateLimit-Limit'));

        // A token presented for the first time starts with its full budget
        // rather than inheriting whatever the anonymous caller already spent.
        $this->assertSame(179, (int) $authenticated->headers->get('X-RateLimit-Remaining'));

        $second = $this->getJson('/api/v1/products')->assertOk();

        $this->assertSame(
            (int) $authenticated->headers->get('X-RateLimit-Remaining') - 1,
            (int) $second->headers->get('X-RateLimit-Remaining'),
            'Consecutive authenticated requests must draw down one shared token budget.'
        );
    }

    public function test_signing_out_revokes_the_current_token(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $user = User::factory()->owner()->forBusiness($business)->create([
            'email' => 'logout@example.com',
            'password' => Hash::make('Correct-Horse-42'),
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'logout@example.com',
            'password' => 'Correct-Horse-42',
        ])->json('token');

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/auth/logout')
            ->assertOk();

        $this->assertSame(0, $user->fresh()->tokens()->count());
    }

    public function test_changing_a_password_requires_the_current_one(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $user = User::factory()->owner()->forBusiness($business)->create([
            'password' => Hash::make('Correct-Horse-42'),
        ]);

        $this->actingAsApi($user)
            ->putJson('/api/v1/settings/password', [
                'current_password' => 'Not-The-Password',
                'password' => 'Brand-New-Pass-77',
                'password_confirmation' => 'Brand-New-Pass-77',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_password');

        $this->actingAsApi($user)
            ->putJson('/api/v1/settings/password', [
                'current_password' => 'Correct-Horse-42',
                'password' => 'Brand-New-Pass-77',
                'password_confirmation' => 'Brand-New-Pass-77',
            ])
            ->assertOk();

        $this->assertTrue(Hash::check('Brand-New-Pass-77', $user->fresh()->password));
    }
}
