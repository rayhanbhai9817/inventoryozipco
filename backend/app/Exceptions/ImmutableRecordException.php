<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

final class ImmutableRecordException extends RuntimeException
{
    public static function forUpdate(string $model): self
    {
        return new self(sprintf(
            '%s records are append-only and cannot be updated. Record a compensating entry instead.',
            class_basename($model)
        ));
    }

    public static function forDelete(string $model): self
    {
        return new self(sprintf(
            '%s records are append-only and cannot be deleted.',
            class_basename($model)
        ));
    }
}
