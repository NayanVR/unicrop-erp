<?php

namespace App\Models\Concerns;

use App\Models\Company;
use App\Services\CurrentCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Scope;

trait BelongsToCompany
{
    public static function bootBelongsToCompany(): void
    {
        static::addGlobalScope(new class implements Scope
        {
            public function apply(Builder $builder, $model): void
            {
                $companyId = app(CurrentCompany::class)->id();

                if ($companyId !== null) {
                    $builder->where($model->qualifyColumn('company_id'), $companyId);
                }
            }
        });

        static::creating(function ($model) {
            if ($model->company_id === null) {
                $model->company_id = app(CurrentCompany::class)->id();
            }
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
