// auth.ts
import { auth, db } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const provider = new GoogleAuthProvider();

export async function loginGoogle(): Promise<void> {
  try {
    const result = await signInWithPopup(auth, provider);
    const user   = result.user;
    const perfil = await buscarPerfil(user.email!);

    if (!perfil) {
      await signOut(auth);
      alert('Acesso negado! Seu e-mail não tem permissão.\nFale com o administrador.');
      return;
    }

    sessionStorage.setItem('perfil', perfil);
    sessionStorage.setItem('nome',   user.displayName ?? 'Usuário');
    sessionStorage.setItem('email',  user.email ?? '');
    sessionStorage.setItem('foto',   user.photoURL ?? '');

  } catch (erro: any) {
    if (erro.code !== 'auth/popup-closed-by-user') {
      console.error('Erro no login:', erro);
      alert('Erro ao fazer login. Tente novamente.');
    }
  }
}

export async function logoutGoogle(): Promise<void> {
  await signOut(auth);
  sessionStorage.clear();
}

export async function buscarPerfil(email: string): Promise<string | null> {
  try {
    const docSnap = await getDoc(doc(db, 'usuarios', email));
    return docSnap.exists() ? docSnap.data().perfil ?? null : null;
  } catch { return null; }
}

export function observarAuth(callback: (user: User | null) => void): void {
  onAuthStateChanged(auth, callback);
}

export function getPerfilAtual(): string | null { return sessionStorage.getItem('perfil'); }
export function getNomeAtual():   string        { return sessionStorage.getItem('nome')   ?? 'Usuário'; }
export function getFotoAtual():   string        { return sessionStorage.getItem('foto')   ?? ''; }
export function getEmailAtual():  string        { return sessionStorage.getItem('email')  ?? ''; }