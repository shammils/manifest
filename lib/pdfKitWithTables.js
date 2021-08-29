const PDFDocument = require('pdfkit');

/*
  shitty. need a way to switch table designs. Image support was hacked in, not
  properly implemented
*/
class PDFDocumentWithTables extends PDFDocument {
    constructor (options) {
        super(options);
    }

    table (table, arg0, arg1, arg2) {
        let startX = this.page.margins.left, startY = this.y;
        let options = {};

        if ((typeof arg0 === 'number') && (typeof arg1 === 'number')) {
            startX = arg0;
            startY = arg1;

            if (typeof arg2 === 'object')
                options = arg2;
        } else if (typeof arg0 === 'object') {
            options = arg0;
        }

        const columnCount = table.headers.length;
        const columnSpacing = options.columnSpacing || 15;
        const rowSpacing = options.rowSpacing || 5;
        const usableWidth = options.width || (this.page.width - this.page.margins.left - this.page.margins.right);

        const prepareHeader = options.prepareHeader || (() => {});
        const prepareRow = options.prepareRow || (() => {});

        const computeRowHeight = (row, padding=0) => {
            let result = 0;

            row.forEach((cell) => {
                const cellHeight = this.heightOfString(cell, {
                    width: columnWidth,
                    align: 'left'
                });
                result = Math.max(result, cellHeight);
            });
            let computedHeight = result + rowSpacing;
            if (computedHeight < padding)
              computedHeight = padding
            return computedHeight;
        };

        const columnContainerWidth = usableWidth / columnCount;
        const columnWidth = columnContainerWidth - columnSpacing;
        const maxY = this.page.height - this.page.margins.bottom;

        let rowBottomY = 0;

        this.on('pageAdded', () => {
            startY = this.page.margins.top;
            rowBottomY = 0;
        });

        // Allow the user to override style for headers
        prepareHeader();

        // Check to have enough room for header and first rows
        if (startY + 3 * computeRowHeight(table.headers) > maxY)
            this.addPage();

        // Print all headers
        table.headers.forEach((header, i) => {
            this.text(header, startX + i * columnContainerWidth, startY, {
                width: columnWidth,
                align: 'left'
            });
        });

        // Refresh the y coordinate of the bottom of the headers row
        rowBottomY = Math.max(startY + computeRowHeight(table.headers), rowBottomY);

        // Separation line between headers and rows
        this.moveTo(startX, rowBottomY - rowSpacing * 0.5)
            .lineTo(startX + usableWidth, rowBottomY - rowSpacing * 0.5)
            .lineWidth(2)
            .stroke();

        table.rows.forEach((row, i) => {
            const rowHeight = computeRowHeight(row, 105);

            // Switch to next page if we cannot go any further because the space is over.
            // For safety, consider 3 rows margin instead of just one
            if (startY + 2 * rowHeight < maxY)
                startY = rowBottomY + rowSpacing;
            else
                this.addPage();

            // Allow the user to override style for rows
            prepareRow(row, i);

            // Print all cells of the current row
            row.forEach((cell, i) => {
                switch(typeof cell) {
                  case 'string': {
                    this.text(cell, startX + i * columnContainerWidth, startY, {
                        width: columnWidth,
                        align: 'left'
                    });
                  } break;
                  case 'object': {
                    if (cell.type === 'image') {
                      try {
                        this.image(cell.path, startX + i * columnContainerWidth, startY, {
                          width: 80,
                          height: 100
                        })
                      } catch(err) {
                        console.log(`image broken: ${cell.path}`)
                      }
                    } else if (cell.type === 'link') {
                      this.text(cell.text, startX + i * columnContainerWidth, startY, {
                          width: columnWidth,
                          align: 'left',
                          link: cell.url,
                      });
                    }
                  }
                }
            });

            // Refresh the y coordinate of the bottom of this row
            rowBottomY = Math.max(startY + rowHeight, rowBottomY);

            // Separation line between rows
            this.moveTo(startX, rowBottomY - rowSpacing * 0.5)
                .lineTo(startX + usableWidth, rowBottomY - rowSpacing * 0.5)
                .lineWidth(1)
                .opacity(0.7)
                .stroke()
                .opacity(1); // Reset opacity after drawing the line
        });

        this.x = startX;
        this.moveDown();

        return this;
    }
}

module.exports = PDFDocumentWithTables;
