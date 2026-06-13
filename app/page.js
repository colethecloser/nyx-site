import { homeHtml } from '../lib/homeHtml';

export const metadata = {
  title: 'NYX-1 — Buy back your nights',
  description: 'A restorative sleep engine that makes the sleep you get deeper and faster, and hands the difference back to you as time. Cleaner than caffeine or stimulants.',
};

export default function Home() {
  return <main dangerouslySetInnerHTML={{ __html: homeHtml }} />;
}
