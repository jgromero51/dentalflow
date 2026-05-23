/**
 * DentalFlow — Generador de PDF con pdfkit
 */
const PDFDocument = require('pdfkit');

const AZUL    = '#1a6fc4';
const GRIS    = '#555555';
const GRIS_L  = '#888888';
const BG_FILA = '#f4f7fd';

function generateProformaPDF(pf, patient, settings) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const clinica      = settings.clinic_name    || 'Consultorio Dental';
    const ruc          = settings.clinic_ruc     || '';
    const direccion    = settings.clinic_address || '';
    const telClinica   = settings.clinic_phone   || '';
    const emailClinica = settings.clinic_email   || '';
    const doctor       = settings.doctor_name    || clinica;
    const validezDias  = parseInt(settings.proforma_validez_dias) || 15;

    const items = Array.isArray(pf.items) ? pf.items : JSON.parse(pf.items_json || '[]');
    const total = parseFloat(pf.total) || 0;

    const ahora       = new Date();
    const fecha       = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const validezFecha = new Date(ahora.getTime() + validezDias * 86400000)
      .toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

    // ── HEADER ──────────────────────────────────────────────────────
    doc.fontSize(20).fillColor(AZUL).font('Helvetica-Bold').text(clinica, 40, 42);

    let subY = 66;
    doc.fontSize(9).fillColor(GRIS).font('Helvetica');
    if (ruc)          { doc.text(`RUC: ${ruc}`,         40, subY); subY += 12; }
    if (direccion)    { doc.text(direccion,              40, subY); subY += 12; }
    if (telClinica)   { doc.text(`Tel: ${telClinica}`,  40, subY); subY += 12; }
    if (emailClinica) { doc.text(emailClinica,           40, subY); }

    // Badge PROFORMA (derecha)
    doc.rect(415, 40, 140, 26).fill(AZUL);
    doc.fontSize(13).fillColor('#fff').font('Helvetica-Bold')
       .text('PROFORMA', 415, 48, { width: 140, align: 'center' });
    doc.fontSize(9).fillColor(GRIS).font('Helvetica')
       .text(`Fecha: ${fecha}`,  415, 72, { width: 140 })
       .text(`N° ${pf.id}`,      415, 84, { width: 140 });

    // Línea azul separadora
    const lineY = 110;
    doc.moveTo(40, lineY).lineTo(555, lineY).strokeColor(AZUL).lineWidth(2).stroke();

    // ── DATOS PACIENTE ───────────────────────────────────────────────
    const boxY = lineY + 10;
    doc.rect(40, boxY, 515, 56).fillAndStroke('#f7f9fc', '#dde5f0');
    doc.fontSize(7.5).fillColor(GRIS_L).font('Helvetica').text('PACIENTE', 52, boxY + 8);
    doc.fontSize(12).fillColor('#1a1a1a').font('Helvetica-Bold').text(patient.nombre, 52, boxY + 18);
    doc.fontSize(9).fillColor(GRIS).font('Helvetica');
    let infoX = 52;
    if (patient.dni)     { doc.text(`DNI: ${patient.dni}`,       infoX, boxY + 34); infoX += 120; }
    if (patient.telefono){ doc.text(`Tel: ${patient.telefono}`,  infoX, boxY + 34); }

    // ── TABLA ────────────────────────────────────────────────────────
    let y = boxY + 70;

    // Cabecera tabla
    doc.rect(40, y, 515, 22).fill(AZUL);
    doc.fontSize(9).fillColor('#fff').font('Helvetica-Bold')
       .text('#',            50,  y + 6, { width: 25 })
       .text('TRATAMIENTO', 80,  y + 6, { width: 355 })
       .text('PRECIO',      445, y + 6, { width: 100, align: 'right' });
    y += 22;

    // Filas
    items.forEach((item, i) => {
      const nombre = item.nombre || item.desc || '';
      const precio = parseFloat(item.precio) || 0;
      const bg     = i % 2 === 0 ? '#ffffff' : BG_FILA;
      doc.rect(40, y, 515, 22).fill(bg);
      doc.fontSize(9).fillColor('#1a1a1a').font('Helvetica')
         .text(String(i + 1), 50,  y + 6, { width: 25 })
         .text(nombre,        80,  y + 6, { width: 355 })
         .text(`S/ ${precio.toFixed(2)}`, 445, y + 6, { width: 100, align: 'right' });
      y += 22;
    });

    // Fila total
    doc.rect(40, y, 515, 26).fill(AZUL);
    doc.fontSize(11).fillColor('#fff').font('Helvetica-Bold')
       .text('TOTAL', 80, y + 7, { width: 360 })
       .text(`S/ ${total.toFixed(2)}`, 445, y + 7, { width: 100, align: 'right' });
    y += 26;

    // Notas
    if (pf.notas && pf.notas.trim()) {
      y += 10;
      doc.rect(40, y, 515, 28).fill('#fffbea');
      doc.rect(40, y, 3, 28).fill('#f59e0b');
      doc.fontSize(9).fillColor(GRIS).font('Helvetica')
         .text(`Notas: ${pf.notas}`, 50, y + 8, { width: 500 });
      y += 28;
    }

    // Validez
    y += 16;
    doc.fontSize(8.5).fillColor(GRIS_L).font('Helvetica')
       .text(`Valida hasta el ${validezFecha} (${validezDias} dias desde la fecha de emision).`,
             40, y, { width: 515, align: 'center' });

    // Firma
    y += 52;
    doc.moveTo(370, y).lineTo(555, y).strokeColor('#1a1a1a').lineWidth(1).stroke();
    doc.fontSize(10).fillColor('#1a1a1a').font('Helvetica-Bold')
       .text(doctor, 370, y + 6, { width: 185, align: 'center' });
    doc.fontSize(8.5).fillColor(GRIS_L).font('Helvetica')
       .text('Cirujano Dentista', 370, y + 20, { width: 185, align: 'center' });

    // Footer
    const footerY = doc.page.height - 55;
    doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.fontSize(7.5).fillColor('#aaaaaa').font('Helvetica')
       .text(`Documento informativo generado con DentalFlow | ${clinica} | ${fecha}`,
             40, footerY + 10, { width: 515, align: 'center' });

    doc.end();
  });
}

module.exports = { generateProformaPDF };
