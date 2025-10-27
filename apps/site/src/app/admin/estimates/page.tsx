import { redirect } from 'next/navigation';

export default function EstimatesRedirect(){
  redirect('/team?tab=estimates');
}

