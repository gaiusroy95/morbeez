import { Redirect } from 'expo-router';

/** @deprecated Use /roi/transactions/add-expense */
export default function LabourAddRedirect() {
  return <Redirect href="/roi/transactions/add-expense" />;
}
