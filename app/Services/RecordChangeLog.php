<?php

namespace App\Services;

/**
 * Turns a before/after snapshot of a record into a short, readable list of
 * what actually changed, stored on the row as `last_changes`.
 *
 * Shape it produces:
 *   [
 *     'at'     => '2026-09-30T10:00:00+00:00',
 *     'by'     => 'Admin User',
 *     'fields' => [ ['label' => 'Batch Size', 'from' => '1 kg', 'to' => '1.5 kg'] ],
 *     'items'  => [ ['id' => 12, 'name' => 'Rice Bran Oil', 'kind' => 'changed',
 *                    'from' => '160 gm', 'to' => '200 gm'] ],
 *   ]
 */
class RecordChangeLog
{
    /**
     * @param  array<string, mixed>  $fieldsBefore  label => value
     * @param  array<string, mixed>  $fieldsAfter   label => value
     * @param  array<int, array{name: string, summary: string}>  $itemsBefore  id => row
     * @param  array<int, array{name: string, summary: string}>  $itemsAfter   id => row
     * @return array<string, mixed>|null  null when nothing meaningful changed
     */
    public static function build(
        array $fieldsBefore,
        array $fieldsAfter,
        array $itemsBefore = [],
        array $itemsAfter = [],
        ?string $by = null,
    ): ?array {
        $fields = [];
        foreach ($fieldsAfter as $label => $after) {
            $before = $fieldsBefore[$label] ?? null;

            if (self::same($before, $after)) {
                continue;
            }

            $fields[] = [
                'label' => $label,
                'from'  => self::display($before),
                'to'    => self::display($after),
            ];
        }

        $items = [];

        foreach ($itemsAfter as $id => $row) {
            $was = $itemsBefore[$id] ?? null;

            if ($was === null) {
                $items[] = [
                    'id'   => (int) $id,
                    'name' => $row['name'],
                    'kind' => 'added',
                    'to'   => $row['summary'],
                ];
            } elseif ($was['summary'] !== $row['summary']) {
                $items[] = [
                    'id'   => (int) $id,
                    'name' => $row['name'],
                    'kind' => 'changed',
                    'from' => $was['summary'],
                    'to'   => $row['summary'],
                ];
            }
        }

        foreach ($itemsBefore as $id => $row) {
            if (! array_key_exists($id, $itemsAfter)) {
                $items[] = [
                    'id'   => (int) $id,
                    'name' => $row['name'],
                    'kind' => 'removed',
                    'from' => $row['summary'],
                ];
            }
        }

        if ($fields === [] && $items === []) {
            return null;
        }

        return [
            'at'     => now()->toIso8601String(),
            'by'     => $by,
            'fields' => $fields,
            'items'  => $items,
        ];
    }

    /** Numbers compare by value, everything else by its trimmed string form. */
    private static function same(mixed $a, mixed $b): bool
    {
        if (is_numeric($a) && is_numeric($b)) {
            return abs((float) $a - (float) $b) < 0.0001;
        }

        return self::display($a) === self::display($b);
    }

    private static function display(mixed $v): string
    {
        if ($v === null || $v === '') {
            return '—';
        }

        if (is_bool($v)) {
            return $v ? 'Yes' : 'No';
        }

        if (is_numeric($v)) {
            // Drop the trailing zeros Eloquent's decimal casts add.
            return rtrim(rtrim(number_format((float) $v, 3, '.', ''), '0'), '.') ?: '0';
        }

        return trim((string) $v);
    }
}
