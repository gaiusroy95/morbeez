import { Redirect } from 'expo-router';

/** @deprecated Use /roi/transactions/add-expense */
export default function QuickExpenseRedirect() {
  return <Redirect href="/roi/transactions/add-expense" />;
}
