<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotent safety migration — adds any columns that previous migrations may have
 * failed to create (e.g. due to a partial run that was never recorded).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── orders table ─────────────────────────────────────────────────────
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'party_id')) {
                $table->foreignId('party_id')->nullable()->constrained('parties')->nullOnDelete()->after('order_number');
            }
            if (! Schema::hasColumn('orders', 'gst_no')) {
                $table->string('gst_no', 20)->nullable()->after('customer_name');
            }
            if (! Schema::hasColumn('orders', 'pan_no')) {
                $table->string('pan_no', 20)->nullable();
            }
            if (! Schema::hasColumn('orders', 'aadhaar_no')) {
                $table->string('aadhaar_no', 20)->nullable();
            }
            if (! Schema::hasColumn('orders', 'transport_type')) {
                $table->string('transport_type')->default('transport')->after('transport_name');
            }
            if (! Schema::hasColumn('orders', 'urgent_approved')) {
                $table->boolean('urgent_approved')->nullable()->after('priority');
            }
            if (! Schema::hasColumn('orders', 'urgent_approved_by')) {
                $table->foreignId('urgent_approved_by')->nullable()->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('orders', 'urgent_approved_at')) {
                $table->timestamp('urgent_approved_at')->nullable();
            }
        });

        // ── parties table ────────────────────────────────────────────────────
        Schema::table('parties', function (Blueprint $table) {
            if (! Schema::hasColumn('parties', 'customer_name')) {
                $table->string('customer_name')->nullable()->after('name');
            }
            if (! Schema::hasColumn('parties', 'default_transport_type')) {
                $table->enum('default_transport_type', ['transport', 'courier'])->nullable();
            }
            if (! Schema::hasColumn('parties', 'default_transport_id')) {
                $table->foreignId('default_transport_id')->nullable()->constrained('transports')->nullOnDelete();
            }
        });

        // ── order_attachments table ──────────────────────────────────────────
        Schema::table('order_attachments', function (Blueprint $table) {
            if (! Schema::hasColumn('order_attachments', 'document_type')) {
                $table->string('document_type')->nullable()->after('size');
            }
        });
    }

    public function down(): void
    {
        // no-op — this migration only adds missing columns; reversing is not safe
    }
};
