
 document.addEventListener('DOMContentLoaded', function() {
            // View toggle functionality
            const toggleButtons = document.querySelectorAll('.toggle-btn');
            const viewSections = document.querySelectorAll('.view-section');
            
            toggleButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const targetView = this.dataset.view;
                    
                    // Remove active class from all buttons and sections
                    toggleButtons.forEach(btn => btn.classList.remove('active'));
                    viewSections.forEach(section => section.classList.remove('active'));
                    
                    // Add active class to clicked button and corresponding section
                    this.classList.add('active');
                    document.getElementById(targetView + '-view').classList.add('active');
                });
            });
            
            // Table sorting functionality
            const tables = document.querySelectorAll('.data-table');
            
            tables.forEach(table => {
                const headers = table.querySelectorAll('th');
                
                headers.forEach((header, index) => {
                    if (header.textContent.includes('Date') || header.textContent.includes('Amount')) {
                        header.style.cursor = 'pointer';
                        header.addEventListener('click', () => sortTable(table, index));
                    }
                });
            });
            
            function sortTable(table, columnIndex) {
                const tbody = table.querySelector('tbody');
                const rows = Array.from(tbody.querySelectorAll('tr'));
                
                if (rows.length === 0 || rows[0].cells.length <= columnIndex) return;
                
                const isAscending = table.dataset.sortOrder !== 'asc';
                table.dataset.sortOrder = isAscending ? 'asc' : 'desc';
                
                rows.sort((a, b) => {
                    const aValue = a.cells[columnIndex].textContent.trim();
                    const bValue = b.cells[columnIndex].textContent.trim();
                    
                    // Check if it's a date column
                    if (aValue.match(/\d{1,2}\s\w{3}\s\d{4}/)) {
                        const aDate = new Date(aValue);
                        const bDate = new Date(bValue);
                        return isAscending ? aDate - bDate : bDate - aDate;
                    }
                    
                    // Check if it's an amount column
                    if (aValue.includes('₹')) {
                        const aAmount = parseFloat(aValue.replace(/[₹,]/g, ''));
                        const bAmount = parseFloat(bValue.replace(/[₹,]/g, ''));
                        return isAscending ? aAmount - bAmount : bAmount - aAmount;
                    }
                    
                    // Default string comparison
                    return isAscending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                });
                
                // Re-append sorted rows
                rows.forEach(row => tbody.appendChild(row));
            }
        });

        // Image modal functionality
        function showImageModal(imageUrl) {
            const modal = document.getElementById('imageModal');
            const modalImage = document.getElementById('modalImage');
            
            modalImage.src = imageUrl;
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }

        function closeImageModal() {
            const modal = document.getElementById('imageModal');
            modal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }

        // Close modal with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeImageModal();
            }
        });