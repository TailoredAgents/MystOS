import { redirect } from 'next/navigation';

export default function PaymentsRedirect(){
  redirect('/team?tab=payments');
}

