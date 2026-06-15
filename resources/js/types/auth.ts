export type Role = {
    id: number;
    name: string;
    slug: string;
};

export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    phone?: string | null;
    notes?: string | null;
    is_active?: boolean;
    cost_access?: boolean;
    modules?: string[] | null;
    hidden_nav_items?: string[] | null;
    permissions?: string[] | null;
    company_access?: string[] | null;
    roles?: Role[];
    role?: string | null;
    password_plain?: string | null;
    sessions?: { ip_address: string | null; user_agent: string | null; last_activity: number }[];
    [key: string]: unknown;
};

export type Auth = {
    user: User | null;
};

/* @chisel-passkeys */
export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};
/* @end-chisel-passkeys */
