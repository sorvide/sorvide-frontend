// Mobile notification
function addMobileNotification() {
    if (window.innerWidth <= 768) {
        // Remove existing notification if any
        const existingNotification = document.querySelector('.mobile-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create new notification
        const notification = document.createElement('div');
        notification.className = 'mobile-notification';
        notification.innerHTML = `
            <i class="fas fa-desktop"></i>
            Desktop Chrome Extension Only
        `;
        document.body.prepend(notification);
    }
}

// Fix terms/privacy pages for mobile
function fixTermsPrivacyPages() {
    if (document.body.classList.contains('terms-page') || 
        document.body.classList.contains('privacy-page')) {
        
        // Remove any existing back button from top
        const navActions = document.querySelector('.nav-actions');
        if (navActions && window.innerWidth <= 768) {
            navActions.style.display = 'none';
        }
        
        // Add back button at the very bottom of content
        const contentSection = document.querySelector('.terms-content, .privacy-content');
        if (contentSection && window.innerWidth <= 768) {
            const existingBackButton = contentSection.querySelector('.back-to-home-mobile');
            if (!existingBackButton) {
                const backButton = document.createElement('a');
                backButton.href = 'index.html';
                backButton.className = 'back-to-home-mobile';
                backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Back to Home';
                contentSection.appendChild(backButton);
            }
        }
        
        // Fix TOC scrolling
        const tocLinks = document.querySelectorAll('.terms-toc a, .privacy-toc a');
        const contentSections = document.querySelectorAll('.terms-content h2, .privacy-content h2');
        
        // Add IDs to sections
        contentSections.forEach((section, index) => {
            if (!section.id) {
                section.id = 'section-' + index;
            }
        });
        
        // Update TOC links
        tocLinks.forEach((link, index) => {
            if (contentSections[index]) {
                link.href = '#' + contentSections[index].id;
                
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const targetId = this.href.split('#')[1];
                    const targetElement = document.getElementById(targetId);
                    
                    if (targetElement) {
                        const notificationHeight = document.querySelector('.mobile-notification')?.offsetHeight || 0;
                        const targetPosition = targetElement.offsetTop - notificationHeight - 20;
                        
                        window.scrollTo({
                            top: targetPosition,
                            behavior: 'smooth'
                        });
                        
                        // Update active link
                        tocLinks.forEach(l => l.classList.remove('active'));
                        this.classList.add('active');
                    }
                });
            }
        });
    }
}

// Remove "All rights reserved" from footer on mobile
function fixFooterForMobile() {
    if (window.innerWidth <= 768) {
        const footerCopyright = document.querySelector('.footer-copyright p');
        if (footerCopyright) {
            // Keep only the year and Sorvide
            const year = new Date().getFullYear();
            footerCopyright.innerHTML = `&copy; ${year} Sorvide`;
        }
    }
}

// Initialize everything
document.addEventListener('DOMContentLoaded', function() {
    // Add mobile notification
    addMobileNotification();
    
    // Fix terms/privacy pages
    fixTermsPrivacyPages();
    
    // Fix footer for mobile
    fixFooterForMobile();
    
    // Handle window resize
    window.addEventListener('resize', function() {
        addMobileNotification();
        fixTermsPrivacyPages();
        fixFooterForMobile();
    });
    
    // Set current year in footer
    const currentYear = new Date().getFullYear();
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = currentYear;
    }
    
    // Set current date for memo
    const currentDate = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = currentDate.toLocaleDateString('en-US', options);
    
    const memoDateDisplay = document.getElementById('memoDateDisplay');
    if (memoDateDisplay) {
        memoDateDisplay.textContent = formattedDate;
    }
    
    // Smooth scrolling for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            if (targetId.startsWith('#') && targetId !== '#home') {
                e.preventDefault();
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    const notificationHeight = document.querySelector('.mobile-notification')?.offsetHeight || 0;
                    const targetPosition = targetElement.offsetTop - notificationHeight - 20;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // Protect demo text from editing
    const demoTextDisplay = document.getElementById('demoText');
    if (demoTextDisplay) {
        demoTextDisplay.setAttribute('contenteditable', 'false');
        
        demoTextDisplay.addEventListener('selectstart', function(e) {
            e.preventDefault();
        });
        
        demoTextDisplay.addEventListener('copy', function(e) {
            alert('This sample text is protected. Try the actual Sorvide extension to work with your own research!');
            e.preventDefault();
        });
        
        demoTextDisplay.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
    }
    
    // Demo tab switching
    const demoTabs = document.querySelectorAll('.demo-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (demoTabs.length > 0) {
        demoTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const tabId = this.dataset.tab;
                
                // Update active tab
                demoTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // Show corresponding content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === tabId + 'Tab') {
                        content.classList.add('active');
                    }
                });
            });
        });
    }
    
    // Copy button functionality
    document.addEventListener('click', function(e) {
        if (e.target.closest('.copy-btn')) {
            const btn = e.target.closest('.copy-btn');
            let textToCopy = '';
            
            // Check which tab we're in
            if (btn.closest('#citationsTab')) {
                const citationText = document.querySelector('.citation-text-scroll');
                if (citationText) {
                    textToCopy = citationText.textContent;
                }
            } 
            else if (btn.closest('#memoTab')) {
                const memoContent = document.querySelector('.memo-content-scroll');
                if (memoContent) {
                    const memoClone = memoContent.cloneNode(true);
                    const buttons = memoClone.querySelectorAll('button');
                    buttons.forEach(button => button.remove());
                    textToCopy = memoClone.textContent;
                }
            }
            else if (btn.closest('#summaryTab')) {
                const summaryContent = document.querySelector('.summary-content-scroll');
                if (summaryContent) {
                    textToCopy = summaryContent.textContent;
                }
            }
            
            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy.trim()).then(() => {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    btn.style.background = '#10b981';
                    
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.background = '';
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    alert('Failed to copy text. Please try again.');
                });
            }
        }
    });
    
    // Export button functionality
    const exportButtons = document.querySelectorAll('.export-btn');
    const exportStatus = document.getElementById('exportStatus');

    if (exportButtons.length > 0) {
        exportButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                const format = this.dataset.format;
                e.preventDefault();
                
                const originalHTML = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                this.disabled = true;
                
                // Get clean sample research text
                let researchText = getCleanResearchText();
                
                // Generate file based on format
                setTimeout(() => {
                    try {
                        let fileName, fileContent, fileType;
                        
                        switch(format) {
                            case 'html':
                                fileName = 'Sorvide-Research.html';
                                fileContent = generateHTMLFile(researchText);
                                fileType = 'text/html';
                                break;
                            case 'text':
                                fileName = 'Sorvide-Research.txt';
                                fileContent = generateTextFile(researchText);
                                fileType = 'text/plain';
                                break;
                            case 'word':
                                fileName = 'Sorvide-Research.docx';
                                fileContent = generateWordFile(researchText);
                                fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                                break;
                            default:
                                throw new Error('Invalid format');
                        }
                        
                        // Create download
                        const blob = new Blob([fileContent], { type: fileType });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileName;
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        
                        // Cleanup
                        setTimeout(() => {
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }, 100);
                        
                        // Update UI
                        this.innerHTML = '<i class="fas fa-check"></i> Downloaded!';
                        this.style.background = '#10b981';
                        exportStatus.textContent = `${format.toUpperCase()} file downloaded successfully!`;
                        exportStatus.className = 'export-status success';
                        
                    } catch (error) {
                        console.error('Export error:', error);
                        this.innerHTML = originalHTML;
                        this.disabled = false;
                        exportStatus.textContent = 'Failed to generate file. Please try again.';
                        exportStatus.className = 'export-status error';
                    }
                    
                    // Reset button after 3 seconds
                    setTimeout(() => {
                        this.innerHTML = originalHTML;
                        this.disabled = false;
                        this.style.background = '';
                        exportStatus.className = 'export-status';
                        exportStatus.textContent = '';
                    }, 3000);
                    
                }, 1000); // Simulate processing delay
            });
        });
    }
    
    // FAQ functionality
    const faqQuestions = document.querySelectorAll('.faq-question');
    if (faqQuestions.length > 0) {
        faqQuestions.forEach(question => {
            question.addEventListener('click', function() {
                const answer = this.nextElementSibling;
                const isOpen = answer.classList.contains('open');
                
                const parentColumn = this.closest('.faq-column');
                parentColumn.querySelectorAll('.faq-answer').forEach(item => {
                    item.classList.remove('open');
                });
                parentColumn.querySelectorAll('.faq-question').forEach(item => {
                    item.classList.remove('active');
                });
                
                if (!isOpen) {
                    answer.classList.add('open');
                    this.classList.add('active');
                }
            });
        });
    }
    
    // Citation style selector
    const citationStyleSelect = document.getElementById('citationStyle');
    if (citationStyleSelect) {
        citationStyleSelect.addEventListener('change', function() {
            updateCitationText(this.value);
        });
        
        updateCitationText('apa');
    }
    
    // Initialize hero animation
    setTimeout(initHeroAnimation, 500);
    
    // Initialize scroll animations
    setTimeout(() => {
        checkVisibility();
    }, 100);
});

// Helper function to get clean research text
function getCleanResearchText() {
    return `Artificial Intelligence in Modern Research

The integration of artificial intelligence into academic research has fundamentally transformed scholarly practices across disciplines. Modern AI systems, particularly large language models, demonstrate unprecedented capabilities in processing, analyzing, and synthesizing vast amounts of academic literature. These systems can identify patterns and connections that might elude human researchers, while simultaneously ensuring consistency in methodology and reporting.

Recent advancements in natural language processing have enabled AI to comprehend complex academic texts, extract key insights, generate coherent summaries, and even propose novel research directions. However, ethical considerations remain paramount, including concerns about algorithmic bias, data privacy, and the appropriate attribution of AI-assisted work.

The most significant impact has been observed in literature review processes, where AI can reduce weeks of manual work to hours. Additionally, AI-powered tools enhance research quality by providing instant plagiarism checks, generating properly formatted citations, and ensuring adherence to academic writing standards across various citation styles including APA, MLA, and Chicago formats. The democratization of research tools through browser extensions makes advanced AI capabilities accessible to students and researchers at all levels.

Looking forward, AI is expected to further revolutionize academic research through predictive analytics, automated hypothesis generation, and collaborative research platforms. These advancements promise to accelerate scientific discovery while maintaining rigorous academic standards and ethical research practices.`;
}

// Generate HTML file
function generateHTMLFile(text) {
    const title = "Sorvide Research Text - AI in Modern Research";
    const date = new Date().toLocaleDateString();
    
    // Clean the text - ensure no extra whitespace
    const cleanedText = text.trim();
    const wordCount = cleanedText.split(/\s+/).filter(word => word.length > 0).length;
    
    // Escape HTML entities and preserve line breaks
    const htmlText = cleanedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    
    // Build HTML with proper indentation
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #f8fafc;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #4a4fd8;
        }
        h1 {
            color: #1e293b;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .metadata {
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            margin-bottom: 30px;
            border-left: 4px solid #4a4fd8;
        }
        .metadata div {
            margin-bottom: 8px;
            color: #64748b;
        }
        .metadata strong {
            color: #475569;
            min-width: 80px;
            display: inline-block;
        }
        .content {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            white-space: pre-line;
            line-height: 1.8;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #94a3b8;
            font-size: 14px;
        }
        .badge {
            background: #4a4fd8;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            display: inline-block;
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="badge">Exported with Sorvide</div>
        <h1>${title}</h1>
    </div>
    
    <div class="metadata">
        <div><strong>Export Date:</strong> ${date}</div>
        <div><strong>Source:</strong> Sorvide Demo Research Text</div>
        <div><strong>Format:</strong> HTML</div>
        <div><strong>Word Count:</strong> ${wordCount} words</div>
        <div><strong>Character Count:</strong> ${cleanedText.length} characters</div>
    </div>
    
    <div class="content">
${htmlText}
    </div>
    
    <div class="footer">
        <p>Generated by Sorvide AI</p>
    </div>
</body>
</html>`;
    
    return html;
}

// Generate text file
function generateTextFile(text) {
    const title = "Sorvide Research Text - AI in Modern Research";
    const date = new Date().toLocaleDateString();
    
    // Clean the text
    const cleanedText = text.trim();
    const wordCount = cleanedText.split(/\s+/).filter(word => word.length > 0).length;
    
    return `Sorvide Research Export
===============================
Title: ${title}
Date: ${date}
Source: Sorvide Demo Research Text
Format: Plain Text
Word Count: ${wordCount} words
Character Count: ${cleanedText.length} characters

===============================

${cleanedText}

===============================

Generated by Sorvide AI`;
}

// Generate Word file (demo version)
function generateWordFile(text) {
    const title = "Sorvide Research Text - AI in Modern Research";
    const date = new Date().toLocaleDateString();
    const cleanedText = text.trim();
    const wordCount = cleanedText.split(/\s+/).filter(word => word.length > 0).length;
    
    return `Microsoft Word Document - ${title}

Export Date: ${date}
Source: Sorvide Demo Research Text
Format: Microsoft Word (.docx)
Word Count: ${wordCount} words

${'='.repeat(50)}

${cleanedText}

${'='.repeat(50)}

Note: This is a demonstration. In the actual Sorvide Chrome extension,
you would receive a fully formatted .docx file with proper styling,
headers, and academic formatting.

Generated by Sorvide AI`;
}

// Update citation text
function updateCitationText(style) {
    const citationText = document.querySelector('.citation-text-scroll');
    if (!citationText) return;
    
    let newCitation = '';
    
    if (style === 'apa') {
        newCitation = `Researcher, A. (2024). Artificial intelligence in modern academic research: Transformations and ethical considerations. Journal of AI Studies, 15(2), 123-145. https://doi.org/10.1234/ai.2024

Johnson, D. (2023). Natural language processing in academic research: A review of current applications. Computational Linguistics Review, 42(3), 45-67.

Smith, B., & Chen, L. (2022). Machine learning approaches to research methodology. AI Research Methods, 8(1), 89-112.`;
    } else if (style === 'mla') {
        newCitation = `Researcher, Alan. "Artificial Intelligence in Modern Academic Research." Journal of AI Studies, vol. 15, no. 2, 2024, pp. 123-45.

Johnson, David. "Natural Language Processing in Academic Research: A Review of Current Applications." Computational Linguistics Review, vol. 42, no. 3, 2023, pp. 45-67.

Smith, Brian, and Li Chen. "Machine Learning Approaches to Research Methodology." AI Research Methods, vol. 8, no. 1, 2022, pp. 89-112.`;
    }
    
    if (citationText) {
        citationText.textContent = newCitation;
        citationText.style.opacity = '0.7';
        setTimeout(() => {
            citationText.style.opacity = '1';
            citationText.style.transition = 'opacity 0.3s';
        }, 150);
    }
}

// Check visibility for animations
function checkVisibility() {
    const sections = document.querySelectorAll('.faq-section, .pricing-section, .demo-section');
    
    sections.forEach(section => {
        const sectionTop = section.getBoundingClientRect().top;
        const sectionVisible = 150;
        
        if (sectionTop < window.innerHeight - sectionVisible) {
            section.classList.add('visible');
        }
    });
}

// Hero animation
function initHeroAnimation() {
    const codeLines = document.querySelectorAll('.code-line');
    
    codeLines.forEach(line => {
        line.style.opacity = '0';
        line.style.transform = 'translateY(-10px)';
        line.style.transition = 'all 0.5s ease';
    });
    
    codeLines.forEach((line, index) => {
        setTimeout(() => {
            line.style.opacity = '0.7';
            line.style.transform = 'translateY(0)';
            
            setTimeout(() => {
                const check = line.querySelector('.status-check');
                if (check) {
                    check.style.opacity = '1';
                    check.style.transition = 'opacity 0.3s ease';
                }
            }, 300);
            
            line.classList.add('typing');
            
            if (index > 0) {
                codeLines[index - 1].classList.remove('typing');
            }
            
        }, index * 800);
    });
    
    setInterval(() => {
        resetHeroAnimation();
    }, 8000);
}

function resetHeroAnimation() {
    const codeLines = document.querySelectorAll('.code-line');
    
    codeLines.forEach(line => {
        line.style.opacity = '0';
        line.style.transform = 'translateY(-10px)';
        line.classList.remove('typing');
        
        const check = line.querySelector('.status-check');
        if (check) {
            check.style.opacity = '0';
        }
    });
    
    setTimeout(() => {
        codeLines.forEach((line, index) => {
            setTimeout(() => {
                line.style.opacity = '0.7';
                line.style.transform = 'translateY(0)';
                
                setTimeout(() => {
                    const check = line.querySelector('.status-check');
                    if (check) {
                        check.style.opacity = '1';
                    }
                }, 300);
                
                line.classList.add('typing');
                
                if (index > 0) {
                    codeLines[index - 1].classList.remove('typing');
                }
                
            }, index * 800);
        });
    }, 300);
}

// Scroll animations
window.addEventListener('scroll', function() {
    checkVisibility();
});

window.addEventListener('load', function() {
    checkVisibility();
});

window.addEventListener('resize', () => {
    setTimeout(() => {
        checkVisibility();
    }, 100);
});