import { redirect } from 'next/navigation';

export default function QuotesRedirect(){
  redirect('/team?tab=quotes');
}

