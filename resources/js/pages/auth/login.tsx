import { Head, useForm } from '@inertiajs/react';

type Props = {
    status?: string;
};

export default function Login({ status }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: true,
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <>
            <Head title="Sign In" />

            {/* Full-screen redirect overlay — shows while Inertia navigates after successful login */}
            {processing && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '20px',
                }}>
                    <div style={{
                        width: '52px', height: '52px', borderRadius: '14px',
                        background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '26px', backdropFilter: 'blur(8px)',
                    }}>🌿</div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.3px' }}>
                            Signing you in…
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', marginTop: '4px' }}>
                            Unicrop Biochem ERP
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.7)',
                                animation: `loginDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                            }} />
                        ))}
                    </div>
                    <style>{`
                        @keyframes loginDot {
                            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                            40% { transform: scale(1); opacity: 1; }
                        }
                    `}</style>
                </div>
            )}

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
                                <label className="lf-remember">
                                    <input
                                        type="checkbox"
                                        checked={data.remember}
                                        onChange={(e) => setData('remember', e.target.checked)}
                                    />
                                    <span>Keep me signed in on this device</span>
                                </label>
                                <button
                                    className="login-btn"
                                    type="submit"
                                    disabled={processing}
                                    style={processing ? { opacity: 0.85, cursor: 'not-allowed' } : {}}
                                >
                                    {processing
                                        ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <span style={{
                                                width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)',
                                                borderTopColor: '#fff', borderRadius: '50%',
                                                display: 'inline-block', animation: 'spin 0.7s linear infinite',
                                            }} />
                                            Signing in…
                                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                          </span>
                                        : 'Sign In →'
                                    }
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
