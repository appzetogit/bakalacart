import { ShoppingBag } from "lucide-react"
import DisbursementPage from "../components/disbursement/DisbursementPage"

export default function DeliverymanDisbursement() {
  const tabs = ["All", "Pending", "Processing", "Completed", "Partially completed", "Canceled"]
  
  return (
    <DisbursementPage
      title="Deliveryman Disbursement"
      icon={ShoppingBag}
      tabs={tabs}
      disbursements={[]}
      count={0}
    />
  )
}

