<?php

namespace App\Http\Requests;

use App\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOrderRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        if (! $user) {
            return false;
        }

        $user->loadMissing('roles');

        return $user->hasAnyRole([Role::ADMIN, Role::SALES, Role::SALES]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isDraft = $this->boolean('save_as_draft');
        $isCourier = $this->input('transport_type') === 'courier';

        $requiredIfNotDraft = fn (array $rules) => $isDraft ? ['nullable', ...$rules] : ['required', ...$rules];

        return [
            'party_id' => ['nullable', 'integer', Rule::exists('parties', 'id')],
            'company_name' => $requiredIfNotDraft(['string', 'max:255']),
            'customer_name' => $requiredIfNotDraft(['string', 'max:255']),
            'gst_no' => ['nullable', 'string', 'max:20'],
            'pan_no' => ['nullable', 'string', 'max:20', 'required_with:pan_file'],
            'aadhaar_no' => ['nullable', 'string', 'max:20', 'required_with:aadhaar_file'],
            'sales_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'order_date' => $requiredIfNotDraft(['date']),
            'transport_type' => ['nullable', Rule::in(['transport', 'courier'])],
            'transport_name' => $requiredIfNotDraft(['string', 'max:255']),
            'destination' => $requiredIfNotDraft(['string', 'max:255']),
            'delivery_address' => $requiredIfNotDraft(['string', 'max:500']),
            'phone' => ['nullable', 'string', 'max:30'],
            'priority' => $requiredIfNotDraft([Rule::in(['normal', 'high', 'urgent'])]),
            'notes' => ['nullable', 'string', 'max:1000'],
            'freight_amount' => ['nullable', 'numeric', 'min:0'],
            'courier_amount' => $isDraft
                ? ['nullable', 'numeric', 'min:0']
                : ($isCourier ? ['required', 'numeric', 'min:0.01'] : ['nullable', 'numeric', 'min:0']),
            'round_off' => ['nullable', 'numeric'],
            'items' => $isDraft ? ['nullable', 'array'] : ['required', 'array', 'min:1'],
            'items.*.our_brand' => ['nullable', 'string', 'max:255'],
            'items.*.party_brand' => ['nullable', 'string', 'max:255'],
            'items.*.packing_size' => ['nullable', 'string', 'max:100'],
            'items.*.quantity' => $isDraft ? ['nullable', 'numeric', 'min:0'] : ['required', 'numeric', 'min:0.01'],
            'items.*.rate' => $isDraft ? ['nullable', 'numeric', 'min:0'] : ['required', 'numeric', 'min:0'],
            'items.*.gst_percent' => ['nullable', 'numeric', 'min:0'],
            'items.*.type' => ['nullable', 'string', 'max:100'],
            'items.*.shape' => ['nullable', 'string', 'max:100'],
            'items.*.cap_color' => ['nullable', 'string', 'max:100'],
            'attachments' => ['nullable', 'array', 'max:3'],
            'attachments.*' => ['file', 'max:5120', 'mimes:pdf,doc,docx,xls,xlsx,jpg,jpeg,png,txt'],
            'pan_file' => ['nullable', 'file', 'max:5120', 'mimes:pdf,jpg,jpeg,png'],
            'aadhaar_file' => ['nullable', 'file', 'max:5120', 'mimes:pdf,jpg,jpeg,png', 'required_with:aadhaar_no'],
            'save_as_draft' => ['nullable', 'boolean'],
        ];
    }
}
