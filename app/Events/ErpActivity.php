<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class ErpActivity implements ShouldBroadcastNow
{
    public function __construct(
        public readonly string $type,
        public readonly string $message,
        public readonly string $by,
        public readonly array $meta = [],
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel('erp.activity')];
    }

    public function broadcastAs(): string
    {
        return 'activity';
    }
}
