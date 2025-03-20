import { useLocation } from 'preact-iso';
import css from './styles.module.scss';

export function Header() {
  const { url } = useLocation();

  return (
    <header class={css.wrapper}>
      <nav>
        <a href='/' class={url == '/' && 'active'}>
          Home
        </a>
      </nav>
    </header>
  );
}
