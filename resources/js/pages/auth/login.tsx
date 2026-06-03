import { Head, useForm } from '@inertiajs/react';

type Props = {
    status?: string;
};

export default function Login({ status }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/login');
    };

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

                        <form onSubmit={submit}>
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
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
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
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                    />
                                </div>
                                <button
                                    className="login-btn"
                                    type="submit"
                                    disabled={processing}
                                >
                                    {processing ? 'Signing in…' : 'Sign In →'}
                                </button>
                            </div>

                            {(errors.email || errors.password || status) && (
                                <div className="login-errshow" id="l-err">
                                    Invalid credentials. Please try again.
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}
