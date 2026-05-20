import { Approval } from "../types";
import { now, uid } from "../lib/utils";

export class ApprovalService {
  requestApproval(companyId: string, itemType: string, itemId?: string, sessionId?: string, campaignId?: string): Approval {
    return {
      id: uid("approval"),
      companyId,
      sessionId,
      campaignId,
      itemType,
      itemId,
      status: "pending",
      requestedBy: "user_demo",
      notes: "Nada será executado sem aprovação humana.",
      createdAt: now(),
    };
  }

  approveItem(approval: Approval, notes = "Aprovado para execução assistida.") {
    return { ...approval, status: "approved" as const, approvedBy: "user_demo", notes, approvedAt: now() };
  }

  rejectItem(approval: Approval, notes = "Rejeitado para revisão.") {
    return { ...approval, status: "rejected" as const, notes };
  }

  requestChanges(approval: Approval, notes = "Solicitar alteração antes da execução.") {
    return { ...approval, status: "changes_requested" as const, notes };
  }
}
