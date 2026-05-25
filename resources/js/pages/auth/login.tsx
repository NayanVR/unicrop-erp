import { store } from '@/routes/login';
import { Form, Head } from '@inertiajs/react';

type Props = {
    status?: string;
};

export default function Login({ status }: Props) {
    return (
        <>
            <Head title="Sign In" />

            <div id="login-screen">
                <div className="login-grid-bg" />
                <div className="login-container">
                    <div className="login-logo">
                        <div className="login-logo-mark">
                            <span>UBC</span>
                        </div>
                        <h1>Unicrop Biochem</h1>
                        <p>Agrochemical Order Management Portal</p>
                    </div>
                    <div className="login-card">
                        <h2 id="lt-title">Sign In</h2>
                        <div className="sub" id="lt-sub">
                            Enter your credentials to continue
                        </div>

                        <Form {...store.form()} resetOnSuccess={['password']}>
                            {({ processing, errors }) => (
                                <>
                                    <div id="login-fields">
                                        <div className="lf">
                                            <label>Email / Username</label>
                                            <input
                                                type="email"
                                                id="l-email"
                                                name="email"
                                                placeholder="Enter your email"
                                                autoComplete="username"
                                                required
                                                autoFocus
                                            />
                                        </div>
                                        <div className="lf">
                                            <label>Password</label>
                                            <input
                                                type="password"
                                                id="l-pass"
                                                name="password"
                                                placeholder="Enter password"
                                                autoComplete="current-password"
                                                required
                                            />
                                        </div>
                                        <button
                                            className="login-btn"
                                            type="submit"
                                            disabled={processing}
                                        >
                                            Sign In →
                                        </button>
                                    </div>

                                    <div
                                        id="login-role-picker"
                                        style={{ display: 'none' }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '13px',
                                                color: 'rgba(255,255,255,.7)',
                                                marginBottom: '12px',
                                            }}
                                        >
                                            Multiple departments found. Select
                                            which to log in as:
                                        </div>
                                        <div
                                            id="login-role-options"
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '8px',
                                            }}
                                        />
                                        <button
                                            type="button"
                                            style={{
                                                marginTop: '14px',
                                                background: 'transparent',
                                                border: '1px solid rgba(255,255,255,.3)',
                                                color: 'rgba(255,255,255,.7)',
                                                padding: '8px',
                                                borderRadius: '6px',
                                                width: '100%',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                            }}
                                        >
                                            ← Back
                                        </button>
                                    </div>

                                    <div
                                        className={`login-err${
                                            errors.email || errors.password
                                                ? 'show'
                                                : ''
                                        }`}
                                        id="l-err"
                                    >
                                        {errors.email ||
                                        errors.password ||
                                        status
                                            ? 'Invalid credentials. Please try again.'
                                            : 'Invalid credentials. Please try again.'}
                                    </div>
                                </>
                            )}
                        </Form>
                    </div>
                </div>
            </div>
        </>
    );
}
