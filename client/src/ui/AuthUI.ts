import { NetworkController } from '../controllers/NetworkController';
import { deriveHash } from '../utils';
import { Logger } from '../utils/logger';

export class AuthUI {
  private modal: HTMLElement;
  private resolveClose: (() => void) | null = null;

  constructor() {
    this.modal = this.buildModal();
    document.body.appendChild(this.modal);
  }

  show(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.resolveClose = resolve;
      this.modal.classList.remove('hidden');
    });
  }

  private close() {
    this.modal.classList.add('hidden');
    this.resolveClose?.();
    this.resolveClose = null;
  }

  private buildModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'auth-modal hidden';
    modal.innerHTML = `
      <div class="auth-card">
        <h2 class="auth-title">Draw A Mare</h2>
        <p class="auth-subtitle">Collaborative drawing</p>

        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="Anon">Anon</button>
          <button class="auth-tab" data-tab="login">Login</button>
          <button class="auth-tab" data-tab="register">Register</button>
        </div>

        <form class="auth-panel" data-panel="Anon">
          <p class="auth-hint">Continue as a guest. Your layers are owned by this browser only.</p>
          <button class="auth-submit" type="submit">Continue as Anon</button>
        </form>

        <form class="auth-panel hidden" data-panel="login">
          <input class="auth-input" name="login-username" type="text" placeholder="Username" autocomplete="username" />
          <input class="auth-input" name="login-password" type="password" placeholder="Password" autocomplete="current-password" />
          <p class="auth-error hidden" data-error="login"></p>
          <button class="auth-submit" type="submit">Log in</button>
        </form>

        <form class="auth-panel hidden" data-panel="register">
          <input class="auth-input" name="reg-username" type="text" placeholder="Username" autocomplete="username" />
          <input class="auth-input" name="reg-password" type="password" placeholder="Password" autocomplete="new-password" />
          <p class="auth-error hidden" data-error="register"></p>
          <button class="auth-submit" type="submit">Register</button>
        </form>
      </div>
    `;

    modal.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = (tab as HTMLElement).dataset.tab!;
        modal
          .querySelectorAll('.auth-tab')
          .forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        modal.querySelectorAll('.auth-panel').forEach((p) => {
          (p as HTMLElement).classList.toggle(
            'hidden',
            (p as HTMLElement).dataset.panel !== target
          );
        });
        modal
          .querySelectorAll('.auth-error')
          .forEach((e) => e.classList.add('hidden'));
      });
    });

    modal
      .querySelector('[data-panel="Anon"]')!
      .addEventListener('submit', (e) => {
        e.preventDefault();
        this.close();
      });

    modal
      .querySelector('[data-panel="login"]')!
      .addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin(modal);
      });

    modal
      .querySelector('[data-panel="register"]')!
      .addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleRegister(modal);
      });

    const lastUser = localStorage.getItem('last_username');
    if (lastUser) {
      (
        modal.querySelector('[name="login-username"]') as HTMLInputElement
      ).value = lastUser;
      (modal.querySelector('[name="reg-username"]') as HTMLInputElement).value =
        lastUser;
    }

    return modal;
  }

  private showError(
    modal: HTMLElement,
    kind: 'login' | 'register',
    msg: string
  ) {
    const el = modal.querySelector(`[data-error="${kind}"]`) as HTMLElement;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  private async handleLogin(modal: HTMLElement) {
    const username = (
      modal.querySelector('[name="login-username"]') as HTMLInputElement
    ).value.trim();
    const password = (
      modal.querySelector('[name="login-password"]') as HTMLInputElement
    ).value;

    if (!username || !password) {
      this.showError(modal, 'login', 'Username and password are required.');
      return;
    }

    const reducers = NetworkController.getInstance().getReducers();
    if (!reducers) {
      this.showError(modal, 'login', 'Not connected to server.');
      return;
    }

    const passwordHash = await deriveHash(password);
    try {
      await reducers.login({ username, passwordHash });
      localStorage.setItem('last_username', username);
      localStorage.setItem('logged_in_username', username);
      this.close();
    } catch (e) {
      Logger.error('[Auth] Login failed:', e);
      this.showError(
        modal,
        'login',
        e instanceof Error ? e.message : 'Login failed.'
      );
    }
  }

  private async handleRegister(modal: HTMLElement) {
    const username = (
      modal.querySelector('[name="reg-username"]') as HTMLInputElement
    ).value.trim();
    const password = (
      modal.querySelector('[name="reg-password"]') as HTMLInputElement
    ).value;

    if (!username || !password) {
      this.showError(modal, 'register', 'Username and password are required.');
      return;
    }
    if (password.length < 4) {
      this.showError(
        modal,
        'register',
        'Password must be at least 4 characters.'
      );
      return;
    }

    const reducers = NetworkController.getInstance().getReducers();
    if (!reducers) {
      this.showError(modal, 'register', 'Not connected to server.');
      return;
    }

    const passwordHash = await deriveHash(password);
    try {
      await reducers.register({ username, passwordHash });
      localStorage.setItem('last_username', username);
      localStorage.setItem('logged_in_username', username);
      this.close();
    } catch (e) {
      Logger.error('[Auth] Register failed:', e);
      this.showError(
        modal,
        'register',
        e instanceof Error ? e.message : 'Registration failed.'
      );
    }
  }
}
