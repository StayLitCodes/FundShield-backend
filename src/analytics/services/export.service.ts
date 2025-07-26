import { Injectable, Logger } from "@nestjs/common"
import * as fs from "fs"
import * as path from "path"
import * as XLSX from "xlsx"
import * as PDFDocument from "pdfkit"

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name)
  private readonly exportDir = path.join(process.cwd(), "exports")

  constructor() {
    // Ensure export directory exists
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true })
    }
  }

  async exportReport(data: any, format: string, filename: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const baseFilename = `${filename}_${timestamp}`

    switch (format.toLowerCase()) {
      case "csv":
        return this.exportToCsv(data, baseFilename)
      case "excel":
      case "xlsx":
        return this.exportToExcel(data, baseFilename)
      case "pdf":
        return this.exportToPdf(data, baseFilename)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  private async exportToCsv(data: any, filename: string): Promise<string> {
    const filePath = path.join(this.exportDir, `${filename}.csv`)

    try {
      let csvContent = ""

      if (data.summary) {
        csvContent += "Summary\n"
        Object.entries(data.summary).forEach(([key, value]) => {
          csvContent += `${key},${value}\n`
        })
        csvContent += "\n"
      }

      if (data.timeSeries && Array.isArray(data.timeSeries)) {
        csvContent += "Time Series Data\n"
        if (data.timeSeries.length > 0) {
          const headers = Object.keys(data.timeSeries[0])
          csvContent += headers.join(",") + "\n"

          data.timeSeries.forEach((row: any) => {
            const values = headers.map((header) => row[header] || "")
            csvContent += values.join(",") + "\n"
          })
        }
      }

      fs.writeFileSync(filePath, csvContent)
      this.logger.log(`CSV export completed: ${filePath}`)
      return filePath
    } catch (error) {
      this.logger.error(`Failed to export CSV: ${error.message}`)
      throw error
    }
  }

  private async exportToExcel(data: any, filename: string): Promise<string> {
    const filePath = path.join(this.exportDir, `${filename}.xlsx`)

    try {
      const workbook = XLSX.utils.book_new()

      // Summary sheet
      if (data.summary) {
        const summaryData = Object.entries(data.summary).map(([key, value]) => ({ Metric: key, Value: value }))
        const summarySheet = XLSX.utils.json_to_sheet(summaryData)
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary")
      }

      // Time series sheet
      if (data.timeSeries && Array.isArray(data.timeSeries)) {
        const timeSeriesSheet = XLSX.utils.json_to_sheet(data.timeSeries)
        XLSX.utils.book_append_sheet(workbook, timeSeriesSheet, "Time Series")
      }

      // Additional data sheets
      Object.entries(data).forEach(([key, value]) => {
        if (key !== "summary" && key !== "timeSeries" && Array.isArray(value)) {
          const sheet = XLSX.utils.json_to_sheet(value)
          XLSX.utils.book_append_sheet(workbook, sheet, key)
        }
      })

      XLSX.writeFile(workbook, filePath)
      this.logger.log(`Excel export completed: ${filePath}`)
      return filePath
    } catch (error) {
      this.logger.error(`Failed to export Excel: ${error.message}`)
      throw error
    }
  }

  private async exportToPdf(data: any, filename: string): Promise<string> {
    const filePath = path.join(this.exportDir, `${filename}.pdf`)

    try {
      const doc = new PDFDocument()
      doc.pipe(fs.createWriteStream(filePath))

      // Title
      doc.fontSize(20).text(filename.replace(/_/g, " ").toUpperCase(), { align: "center" })
      doc.moveDown()

      // Summary section
      if (data.summary) {
        doc.fontSize(16).text("Summary", { underline: true })
        doc.moveDown()

        Object.entries(data.summary).forEach(([key, value]) => {
          doc.fontSize(12).text(`${key}: ${value}`)
        })
        doc.moveDown()
      }

      // Period information
      if (data.period) {
        doc.fontSize(14).text("Report Period", { underline: true })
        doc.fontSize(12).text(`From: ${data.period.startDate}`)
        doc.text(`To: ${data.period.endDate}`)
        doc.moveDown()
      }

      // Time series data (first 20 rows)
      if (data.timeSeries && Array.isArray(data.timeSeries)) {
        doc.fontSize(14).text("Time Series Data (Sample)", { underline: true })
        doc.moveDown()

        const sampleData = data.timeSeries.slice(0, 20)
        sampleData.forEach((row: any, index: number) => {
          if (index === 0) {
            // Headers
            const headers = Object.keys(row).join(" | ")
            doc.fontSize(10).text(headers, { continued: false })
            doc.text("".padEnd(headers.length, "-"))
          }

          const values = Object.values(row).join(" | ")
          doc.fontSize(10).text(values)
        })
      }

      doc.end()
      this.logger.log(`PDF export completed: ${filePath}`)
      return filePath
    } catch (error) {
      this.logger.error(`Failed to export PDF: ${error.message}`)
      throw error
    }
  }

  async getExportFile(filePath: string): Promise<Buffer> {
    if (!fs.existsSync(filePath)) {
      throw new Error("Export file not found")
    }

    return fs.readFileSync(filePath)
  }

  async deleteExportFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      this.logger.log(`Export file deleted: ${filePath}`)
    }
  }

  async cleanupOldExports(olderThanDays: number): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const files = fs.readdirSync(this.exportDir)

    for (const file of files) {
      const filePath = path.join(this.exportDir, file)
      const stats = fs.statSync(filePath)

      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath)
        this.logger.log(`Old export file deleted: ${file}`)
      }
    }
  }
}
