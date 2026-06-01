<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $items = $request->user()
            ->unreadNotifications()
            ->where('type', \App\Notifications\OrderAllItemsReady::class)
            ->latest()
            ->get()
            ->map(fn ($n) => [
                'id'         => $n->id,
                'data'       => $n->data,
                'created_at' => $n->created_at->toISOString(),
            ]);

        return response()->json($items);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $request->user()
            ->unreadNotifications()
            ->where('id', $id)
            ->first()
            ?->markAsRead();

        return response()->json(['ok' => true]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()
            ->unreadNotifications()
            ->where('type', \App\Notifications\OrderAllItemsReady::class)
            ->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
