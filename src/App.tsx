import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

function App() {
  const [user, setUser] = useState<{id:string; email:string} | null>(null)
  const [notes, setNotes] = useState<{id:string; content:string}[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => {
      if (session) setUser({id: session.user.id, email: session.user.email!})
      setLoading(false)
    })
    const {data: {subscription}} = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s ? {id: s.user.id, email: s.user.email!} : null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Notes + Realtime
  useEffect(() => {
    if (!user) { setNotes([]); return }
    supabase.from('notes').select('*').order('created_at', {ascending: false})
      .then(({data}) => setNotes(data || []))
    const ch = supabase.channel('notes').on('postgres_changes',
      {event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}`},
      (p) => {
        if (p.eventType === 'INSERT') setNotes(n => [p.new as any, ...n])
        else if (p.eventType === 'DELETE') setNotes(n => n.filter(x => x.id !== p.old.id))
      }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [user])

  if (loading) return <div style={styles.center}>Loading…</div>

  if (!user) return (
    <div style={styles.card}>
      <h2 style={styles.h2}>Sign In</h2>
      <AuthForm />
    </div>
  )

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <span style={styles.title}>Notes</span>
        <button onClick={() => supabase.auth.signOut()} style={styles.btnGhost}>
          {user.email}
        </button>
      </header>
      <form onSubmit={async (e) => {
        e.preventDefault()
        if (!text.trim()) return
        await supabase.from('notes').insert({content: text, user_id: user.id})
        setText('')
      }} style={styles.form}>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="New note…" style={styles.textarea} rows={3}
        />
        <button type="submit" style={styles.btn}>Add</button>
      </form>
      <ul style={styles.list}>
        {notes.map(n => (
          <li key={n.id} style={styles.item}>
            <span style={styles.content}>{n.content}</span>
            <button onClick={() => supabase.from('notes').delete().eq('id', n.id)} style={styles.btnDel}>
              ×
            </button>
          </li>
        ))}
        {!notes.length && <li style={styles.empty}>No notes yet</li>}
      </ul>
    </div>
  )
}

function AuthForm() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [mode, setMode] = useState<'in'|'up'>('in')
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const {error} = mode === 'up'
      ? await supabase.auth.signUp({email, password: pass})
      : await supabase.auth.signInWithPassword({email, password: pass})
    if (error) setErr(error.message)
  }

  return (
    <form onSubmit={submit} style={styles.authForm}>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" required style={styles.input} />
      <input value={pass} onChange={e => setPass(e.target.value)} placeholder="Password" type="password" required style={styles.input} />
      {err && <p style={styles.err}>{err}</p>}
      <button type="submit" style={styles.btn}>{mode === 'up' ? 'Sign Up' : 'Sign In'}</button>
      <p style={styles.switch}>
        {mode === 'up' ? 'Have an account?' : "Don't have one?"}{' '}
        <button type="button" onClick={() => setMode(m => m === 'in' ? 'up' : 'in')} style={styles.link}>
          {mode === 'up' ? 'Sign In' : 'Sign Up'}
        </button>
      </p>
    </form>
  )
}

const styles: Record<string, React.CSSProperties> = {
  center: {display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center'},
  container: {maxWidth: 600, margin: '0 auto', padding: 24, minHeight: '100vh', boxSizing: 'border-box'},
  header: {display: 'flex', justifyContent: 'spaceBetween', alignItems: 'center', marginBottom: 24},
  title: {fontSize: 24, fontWeight: 400, color: '#1d1d1f'},
  btnGhost: {background: 'none', border: 'none', color: '#2997ff', cursor: 'pointer', fontSize: 14},
  form: {display: 'flex', gap: 12, marginBottom: 24},
  textarea: {flex: 1, padding: 12, border: '1px solid #d2d2d7', borderRadius: 10, fontSize: 16, resize: 'none', outline: 'none'},
  btn: {padding: '10px 20px', background: '#2997ff', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 16},
  list: {listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8},
  item: {display: 'flex', justifyContent: 'spaceBetween', alignItems: 'center', padding: 12, background: 'white', border: '1px solid #e8e8ed', borderRadius: 10},
  content: {whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1},
  btnDel: {background: 'none', border: 'none', color: '#ff3b30', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 0, width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'},
  empty: {textAlign: 'center', color: '#86868b', padding: 40},
  card: {maxWidth: 360, margin: 'auto', padding: 32, marginTop: '10vh', background: 'white', border: '1px solid #e8e8ed', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.04)'},
  h2: {margin: '0 0 24', textAlign: 'center', fontWeight: 400, fontSize: 24, color: '#1d1d1f'},
  authForm: {display: 'flex', flexDirection: 'column', gap: 12},
  input: {padding: 12, border: '1px solid #d2d2d7', borderRadius: 10, fontSize: 16, outline: 'none'},
  err: {color: '#ff3b30', fontSize: 14, margin: 0, textAlign: 'center'},
  switch: {margin: '16 0 0', textAlign: 'center', fontSize: 14, color: '#6e6e73'},
  link: {background: 'none', border: 'none', color: '#2997ff', cursor: 'pointer', fontSize: 14, padding: 0},
}

export default App