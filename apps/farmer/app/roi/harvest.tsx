import { Redirect } from 'expo-router';

/** @deprecated Use /roi/transactions/add-income */
export default function HarvestRedirect() {
  return <Redirect href="/roi/transactions/add-income" />;
}
