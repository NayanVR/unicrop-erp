<?php

namespace App\Http\Controllers;

use App\Models\Godown;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GodownController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255|unique:godowns,name',
            'location' => 'nullable|string|max:255',
            'notes'    => 'nullable|string|max:500',
        ]);

        Godown::create($data);

        return redirect()->back()->with('success', 'Godown added.');
    }

    public function update(Request $request, Godown $godown): RedirectResponse
    {
        $data = $request->validate([
            'name'      => 'required|string|max:255|unique:godowns,name,' . $godown->id,
            'location'  => 'nullable|string|max:255',
            'notes'     => 'nullable|string|max:500',
            'is_active' => 'boolean',
        ]);

        $godown->update($data);

        return redirect()->back()->with('success', 'Godown updated.');
    }

    public function destroy(Godown $godown): RedirectResponse
    {
        $godown->update(['is_active' => false]);

        return redirect()->back()->with('success', 'Godown deactivated.');
    }

    public function setDefault(Godown $godown): RedirectResponse
    {
        DB::transaction(function () use ($godown) {
            Godown::where('id', '!=', $godown->id)->update(['is_default' => false]);
            $godown->update(['is_default' => true]);
        });

        return redirect()->back()->with('success', "{$godown->name} set as default godown.");
    }
}
