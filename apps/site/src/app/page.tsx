export { metadata } from './(site)/page';
import SiteLayout from './(site)/layout';
import Home from './(site)/page';

export default function Page() {
  return (
    <SiteLayout>
      <Home />
    </SiteLayout>
  );
}
