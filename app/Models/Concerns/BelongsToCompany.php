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
                    $model::applyCompanyScope($builder, $companyId);
                }
            }
        });

        static::creating(function ($model) {
            if ($model->company_id === null) {
                $model->company_id = app(CurrentCompany::class)->id();
            }
        });
    }

    /**
     * How "belongs to the active company" is expressed for this model.
     * Models that are shared between companies may widen this.
     */
    public static function applyCompanyScope(Builder $builder, int $companyId): void
    {
        $builder->where($builder->getModel()->qualifyColumn('company_id'), $companyId);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
