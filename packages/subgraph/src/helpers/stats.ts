import { ProtocolStats } from "../../generated/schema";

/** Load or create the singleton ProtocolStats entity. */
export function getOrCreateStats(): ProtocolStats {
  let stats = ProtocolStats.load("singleton");
  if (stats == null) {
    stats = new ProtocolStats("singleton");
    stats.totalSkills = 0;
    stats.totalAttestations = 0;
    stats.totalAuditors = 0;
    stats.totalDisputes = 0;
    stats.openDisputes = 0;
    stats.totalBounties = 0;
    stats.openBounties = 0;
    stats.unauditedSkills = 0;
  }
  return stats;
}
