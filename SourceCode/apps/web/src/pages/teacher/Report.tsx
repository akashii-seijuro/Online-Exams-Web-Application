import { AlertTriangle, BarChart3, CheckCircle2, Download, RefreshCw, Trophy, UsersRound } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { RichTextDisplay } from "../../components/ui/RichTextDisplay";
import { useTeacherReportQuery } from "../../services/queries/reports";
import type { ReportQuestionStat, TeacherReportResponse } from "../../types/session";
import { cn } from "../../utils/cn";

function formatScore(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(2) : "--";
}

function formatDate(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "--";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}p ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function getPercent(rate: number) {
  return Math.round(Math.min(1, Math.max(0, rate)) * 100);
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getColumnName(index: number) {
  let columnName = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    current = Math.floor((current - 1) / 26);
  }

  return columnName;
}

function createCrc32Table() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    return value >>> 0;
  });
}

const crc32Table = createCrc32Table();

function getCrc32(data: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = (crc32Table[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function createZip(files: { name: string; content: string }[]) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centralDirectory: number[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const crc = getCrc32(contentBytes);
    const localHeader: number[] = [];

    writeUint32(localHeader, 0x04034b50);
    writeUint16(localHeader, 20);
    writeUint16(localHeader, 0x0800);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint32(localHeader, crc);
    writeUint32(localHeader, contentBytes.length);
    writeUint32(localHeader, contentBytes.length);
    writeUint16(localHeader, nameBytes.length);
    writeUint16(localHeader, 0);

    const centralHeader: number[] = [];
    writeUint32(centralHeader, 0x02014b50);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 0x0800);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, crc);
    writeUint32(centralHeader, contentBytes.length);
    writeUint32(centralHeader, contentBytes.length);
    writeUint16(centralHeader, nameBytes.length);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, 0);
    writeUint32(centralHeader, offset);
    centralDirectory.push(...centralHeader, ...nameBytes);

    const headerBytes = new Uint8Array([...localHeader, ...nameBytes]);
    chunks.push(headerBytes, contentBytes);
    offset += headerBytes.length + contentBytes.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectoryBytes = new Uint8Array(centralDirectory);
  chunks.push(centralDirectoryBytes);
  offset += centralDirectoryBytes.length;

  const endRecord: number[] = [];
  writeUint32(endRecord, 0x06054b50);
  writeUint16(endRecord, 0);
  writeUint16(endRecord, 0);
  writeUint16(endRecord, files.length);
  writeUint16(endRecord, files.length);
  writeUint32(endRecord, centralDirectoryBytes.length);
  writeUint32(endRecord, centralDirectoryOffset);
  writeUint16(endRecord, 0);
  chunks.push(new Uint8Array(endRecord));

  const output = new Uint8Array(offset + endRecord.length);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }

  return output;
}

function createWorksheetXml(rows: (string | number)[][]) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((cell, cellIndex) => {
          const cellRef = `${getColumnName(cellIndex)}${rowNumber}`;

          if (typeof cell === "number" && Number.isFinite(cell)) {
            return `<c r="${cellRef}"><v>${cell}</v></c>`;
          }

          return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(String(cell))}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="8" customWidth="1"/>
    <col min="2" max="2" width="28" customWidth="1"/>
    <col min="3" max="3" width="18" customWidth="1"/>
    <col min="4" max="4" width="12" customWidth="1"/>
    <col min="5" max="5" width="14" customWidth="1"/>
    <col min="6" max="6" width="18" customWidth="1"/>
    <col min="7" max="7" width="24" customWidth="1"/>
    <col min="8" max="8" width="14" customWidth="1"/>
    <col min="9" max="9" width="36" customWidth="1"/>
  </cols>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function createLeaderboardWorkbook(rows: (string | number)[][]) {
  return createZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Bảng điểm" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: createWorksheetXml(rows)
    }
  ]);
}

function downloadXlsx(bytes: Uint8Array, fileName: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function exportLeaderboardXlsx(report: TeacherReportResponse) {
  const rows: (string | number)[][] = [
    [
      "Hạng",
      "Tên học sinh",
      "Mã học sinh",
      "Điểm",
      "Điểm tối đa",
      "Thời gian làm bài",
      "Thời điểm nộp bài",
      "Mã phòng",
      "Tên bài kiểm tra"
    ],
    ...report.leaderboard.map((student) => [
      student.rank,
      student.name,
      student.studentCode ?? "--",
      typeof student.score === "number" ? student.score : "--",
      student.maxScore,
      formatDuration(student.timeTaken),
      formatDate(student.submittedAt),
      report.session.roomCode,
      report.session.quiz.title
    ])
  ];

  const safeRoomCode = sanitizeFileName(report.session.roomCode) || "phien-thi";
  downloadXlsx(createLeaderboardWorkbook(rows), `bang-diem-${safeRoomCode}.xlsx`);
}

function getDifficultyLabel(difficulty: ReportQuestionStat["difficulty"]) {
  if (difficulty === "EASY") {
    return "Tốt";
  }

  if (difficulty === "MEDIUM") {
    return "Cần ôn";
  }

  return "Khó";
}

function getDifficultyClasses(difficulty: ReportQuestionStat["difficulty"]) {
  if (difficulty === "EASY") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (difficulty === "MEDIUM") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-danger";
}

export function Report() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { data: report, isError, isLoading, refetch } = useTeacherReportQuery(sessionId);

  const hardestQuestions = useMemo(
    () => [...(report?.questionStats ?? [])].sort((left, right) => left.correctRate - right.correctRate).slice(0, 3),
    [report?.questionStats]
  );
  const hardestQuestion = hardestQuestions[0];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        <div className="grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="h-[520px] animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Không thể tải báo cáo</h1>
            <p className="mt-2 text-sm text-text-secondary">Kiểm tra kết nối hoặc quay lại bảng điều khiển.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => void refetch()} type="button" variant="secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Thử lại
            </Button>
            <Button onClick={() => navigate("/dashboard")} type="button">
              Về bảng điều khiển
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const statCards = [
    {
      label: "Điểm trung bình",
      value: formatScore(report.summary.averageScore),
      helper: `Tối đa ${formatScore(report.summary.maxScore)}`,
      icon: BarChart3,
      color: "text-primary"
    },
    {
      label: "Học sinh tham gia",
      value: report.summary.participantCount.toString(),
      helper: `${report.summary.submittedCount} đã nộp bài`,
      icon: UsersRound,
      color: "text-secondary"
    },
    {
      label: "Câu khó nhất",
      value: hardestQuestion ? `Câu ${hardestQuestion.order}` : "--",
      helper: hardestQuestion ? `${getPercent(hardestQuestion.correctRate)}% đúng` : "Chưa có dữ liệu",
      icon: AlertTriangle,
      color: "text-warning"
    },
    {
      label: "Hoàn thành",
      value:
        report.summary.participantCount > 0
          ? `${Math.round((report.summary.submittedCount / report.summary.participantCount) * 100)}%`
          : "0%",
      helper: "Tỷ lệ nộp bài",
      icon: CheckCircle2,
      color: "text-success"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Báo cáo kết quả</p>
          <h1 className="mt-2 text-3xl font-semibold text-text-primary">{report.session.quiz.title}</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Phòng {report.session.roomCode} - Bắt đầu {formatDate(report.session.startedAt)} - Kết thúc{" "}
            {formatDate(report.session.endedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={report.leaderboard.length === 0}
            onClick={() => exportLeaderboardXlsx(report)}
            type="button"
            variant="secondary"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Xuất Excel
          </Button>
          <Button onClick={() => navigate("/dashboard")} type="button" variant="secondary">
            Về trang chủ
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-secondary">{item.label}</p>
                  <p className="mt-3 font-mono text-3xl font-bold text-text-primary">{item.value}</p>
                  <p className="mt-2 text-sm text-text-secondary">{item.helper}</p>
                </div>
                <Icon className={cn("h-7 w-7", item.color)} aria-hidden="true" />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Bảng xếp hạng</h2>
                <p className="mt-1 text-sm text-text-secondary">Sắp xếp theo điểm và thời gian nộp bài.</p>
              </div>
              <Trophy className="h-7 w-7 text-warning" aria-hidden="true" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[80px_1.5fr_120px_140px_140px] bg-slate-50 px-5 py-3 text-sm font-semibold text-text-secondary">
                <span>Hạng</span>
                <span>Học sinh</span>
                <span className="text-right">Điểm</span>
                <span className="text-right">Thời gian</span>
                <span className="text-right">Nộp bài</span>
              </div>
              {report.leaderboard.length > 0 ? (
                report.leaderboard.map((student) => (
                  <div
                    key={student.participantId}
                    className="grid grid-cols-[80px_1.5fr_120px_140px_140px] items-center border-t border-border px-5 py-4 text-sm transition duration-200 hover:bg-slate-50"
                  >
                    <span className="font-mono text-lg font-bold text-text-primary">#{student.rank}</span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-text-primary">{student.name}</p>
                      <p className="text-xs text-text-secondary">{student.studentCode ?? "Không có mã HS"}</p>
                    </div>
                    <span className="text-right font-mono text-lg font-bold text-text-primary">
                      {formatScore(student.score)}
                    </span>
                    <span className="text-right text-text-secondary">{formatDuration(student.timeTaken)}</span>
                    <span className="text-right text-text-secondary">{formatDate(student.submittedAt)}</span>
                  </div>
                ))
              ) : (
                <div className="border-t border-border px-5 py-12 text-center text-sm text-text-secondary">
                  Chưa có học sinh nộp bài.
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-text-primary">Câu cần ôn tập</h2>
          <p className="mt-1 text-sm text-text-secondary">Ba câu có tỷ lệ đúng thấp nhất.</p>
          <div className="mt-5 space-y-4">
            {hardestQuestions.length > 0 ? (
              hardestQuestions.map((question) => (
                <div key={question.questionId} className="rounded-lg border border-border bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text-primary">Câu {question.order}</p>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-semibold",
                        getDifficultyClasses(question.difficulty)
                      )}
                    >
                      {getDifficultyLabel(question.difficulty)}
                    </span>
                  </div>
                  <RichTextDisplay className="mt-2 text-sm text-text-secondary" content={question.content} />
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-danger transition-all duration-500"
                      style={{ width: `${getPercent(question.correctRate)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-text-secondary">
                    {getPercent(question.correctRate)}% đúng - {question.incorrectCount} sai -{" "}
                    {question.unansweredCount} chưa trả lời
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-border bg-slate-50 px-4 py-6 text-center text-sm text-text-secondary">
                Chưa có dữ liệu câu hỏi.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Phân tích theo câu hỏi</h2>
            <p className="mt-1 text-sm text-text-secondary">Tỷ lệ đúng, sai và chưa trả lời cho từng câu.</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          {report.questionStats.map((question) => {
            const correctPercent = getPercent(question.correctRate);

            return (
              <div key={question.questionId} className="rounded-lg border border-border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary">Câu {question.order}</p>
                    <h3 className="mt-1 text-base font-semibold text-text-primary">
                      <RichTextDisplay content={question.content} />
                    </h3>
                  </div>
                  <span
                    className={cn(
                      "w-fit rounded-full border px-3 py-1 text-xs font-semibold",
                      getDifficultyClasses(question.difficulty)
                    )}
                  >
                    {getDifficultyLabel(question.difficulty)}
                  </span>
                </div>
                <div className="mt-4 h-3 rounded-full bg-slate-200">
                  <div className="h-3 rounded-full bg-success transition-all duration-500" style={{ width: `${correctPercent}%` }} />
                </div>
                <div className="mt-3 grid gap-3 text-sm text-text-secondary sm:grid-cols-4">
                  <span>{correctPercent}% đúng</span>
                  <span>{question.correctCount} đúng</span>
                  <span>{question.incorrectCount} sai</span>
                  <span>{question.unansweredCount} chưa trả lời</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
