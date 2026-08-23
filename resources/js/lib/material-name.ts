/**
 * A material is one product shared by the group, but each company may know it
 * by its own name. The server resolves the active company's name into
 * `display_name`; fall back to the material's default name.
 */
export type NamedMaterial = {
    name?: string | null;
    display_name?: string | null;
};

export const matName = (m?: NamedMaterial | null): string =>
    (m?.display_name || m?.name || '').toString();
