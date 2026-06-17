import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';

export interface ExportContent {
  proposal: string;
  coverLetter?: string;
  jobPost?: string;
  title?: string;
}

/**
 * Export proposal as PDF
 */
export async function exportToPDF(content: ExportContent): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Helper to add text with word wrap
  const addText = (text: string, fontSize: number, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');

    const lines = doc.splitTextToSize(text, maxWidth);
    
    for (const line of lines) {
      if (yPosition > pageHeight - margin - 10) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.5;
    }
    yPosition += 5;
  };

  // Title
  if (content.title) {
    addText(content.title, 16, true);
    yPosition += 5;
  }

  // Job Post (if provided)
  if (content.jobPost) {
    addText('Job Post:', 12, true);
    addText(content.jobPost, 10);
    yPosition += 10;
  }

  // Cover Letter (if provided)
  if (content.coverLetter) {
    addText('Cover Letter:', 12, true);
    addText(content.coverLetter, 10);
    yPosition += 10;
  }

  // Proposal
  addText('Proposal:', 12, true);
  addText(content.proposal, 10);

  // Save the PDF
  const fileName = content.title 
    ? `${content.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
    : 'proposal.pdf';
  doc.save(fileName);
}

/**
 * Export proposal as DOCX
 */
export async function exportToDOCX(content: ExportContent): Promise<void> {
  const children: Paragraph[] = [];

  // Title
  if (content.title) {
    children.push(
      new Paragraph({
        text: content.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );
  }

  // Job Post
  if (content.jobPost) {
    children.push(
      new Paragraph({
        text: 'Job Post',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 },
      })
    );
    children.push(
      new Paragraph({
        text: content.jobPost,
        spacing: { after: 400 },
      })
    );
  }

  // Cover Letter
  if (content.coverLetter) {
    children.push(
      new Paragraph({
        text: 'Cover Letter',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 },
      })
    );
    children.push(
      new Paragraph({
        text: content.coverLetter,
        spacing: { after: 400 },
      })
    );
  }

  // Proposal
  children.push(
    new Paragraph({
      text: 'Proposal',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 200 },
    })
  );
  children.push(
    new Paragraph({
      text: content.proposal,
    })
  );

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = content.title
    ? `${content.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`
    : 'proposal.docx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Export proposal as TXT
 */
export function exportToTXT(content: ExportContent): void {
  let text = '';

  if (content.title) {
    text += `${content.title}\n\n`;
  }

  if (content.jobPost) {
    text += `JOB POST:\n${content.jobPost}\n\n`;
  }

  if (content.coverLetter) {
    text += `COVER LETTER:\n${content.coverLetter}\n\n`;
  }

  text += `PROPOSAL:\n${content.proposal}`;

  const blob = new Blob([text], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = content.title
    ? `${content.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`
    : 'proposal.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

