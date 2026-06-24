export interface ProtocolLineData {
  idx: number;
  markings: string;          // "Прахов 1 кг № 5487 / 2019"
  category: string;          // "К2"
  mass: string;              // "1,600"
  agent: string;             // "Прах"
  agentTradeName: string;    // "" при ТО
  serviceKind: string;       // "ТО" | "П" | "ХИ"
  serviceDate: string;       // "27.05.2026"
  technicianName: string;    // "Х. Христов"
  stickerNo: string;         // "0615"
}

export interface ProtocolData {
  protocolNo: string;        // "55/2026"
  date: string;              // "03.06.2026"
  city: string;              // "Нова Загора"
  ownerName: string;
  ownerAddress: string;
  ownerPhone: string;
  handedBy?: string;         // ПРЕДАЛ + представителят в увода (по подр. „В. Вълков")
  receivedBy?: string;       // ПРИЕЛ (по подр. = ownerName)
  siteId?: string;           // обект (за записване в дневника + пореден номер)
  lines: ProtocolLineData[];
}
