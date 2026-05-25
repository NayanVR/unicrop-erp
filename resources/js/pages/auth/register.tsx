import { login } from '@/routes';
import { Head, Link } from '@inertiajs/react';

export default function Register() {
    return (
        <>
            <Head title="Registration Disabled" />
            <div className="not-auth">
                <div className="icon">🚫</div>
                <h3>Registration Disabled</h3>
                <p>New accounts are created by an admin.</p>
                <Link className="btn primary" href={login()}>
                    Go to Login
                </Link>
            </div>
        </>
    );
}
