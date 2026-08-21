<?php

namespace App\Services;

use App\Models\User;
use App\Http\Resources\UserResource;
use Illuminate\Support\Facades\Hash;

class AuthService
{
    public const TOKEN_NAME = 'trend-discover';

    public const TOKEN_TTL_MINUTES = 60;

    public function register(string $name, string $email, string $password): array
    {
        $user = User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => $password,
        ]);

        return $this->issueToken($user);
    }

    public function login(string $email, string $password): ?array
    {
        $user = User::query()->where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            return null;
        }

        return $this->issueToken($user);
    }

    /**
     * @return array{user: UserResource, token: string, expires_at: string}
     */
    public function issueToken(User $user): array
    {
        $expiresAt = now()->addMinutes(self::TOKEN_TTL_MINUTES);

        $token = $user->createToken(self::TOKEN_NAME, ['*'], $expiresAt);

        return [
            'user' => new UserResource($user),
            'token' => $token->plainTextToken,
            'expires_at' => $expiresAt->toIso8601String(),
        ];
    }
}
