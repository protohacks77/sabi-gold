import React, { useState } from 'react';
import { Icons } from '../common/Icons';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
  icon: React.ReactNode;
}

const faqs: FAQItem[] = [
  {
    question: 'How do I add a new employee?',
    icon: <Icons.Administration />,
    answer: (
      <ol className="list-decimal list-inside space-y-2 text-gray-400">
        <li>Navigate to the <strong>Administration</strong> tab from the sidebar.</li>
        <li>Click the <strong>Add New Employee</strong> button on the top right.</li>
        <li>Fill in the employee's details like name, position, and department.</li>
        <li>(Optional) Assign a 4-digit PIN for them as a backup login method.</li>
        <li>Click <strong>Save</strong>. The new employee will appear in the list.</li>
      </ol>
    ),
  },
  {
    question: 'How do I register an employee\'s face or fingerprint?',
    icon: <Icons.FingerprintScan />,
    answer: (
      <div className="space-y-2 text-gray-400">
          <p>After adding an employee, you can register their biometrics:</p>
          <ol className="list-decimal list-inside space-y-2 pl-4">
              <li>In the <strong>Administration</strong> tab, find the employee in the list.</li>
              <li>Under the "Biometrics" column, click the <Icons.FaceScan className="inline w-4 h-4"/> icon to register their face or the <Icons.FingerprintScan className="inline w-4 h-4"/> icon for their fingerprint.</li>
              <li>A modal will appear with a camera feed or a prompt for the fingerprint sensor.</li>
              <li>Follow the on-screen instructions to complete the registration. The icon will turn green upon success.</li>
          </ol>
      </div>
    ),
  },
  {
    question: 'How do I generate the different types of reports?',
    icon: <Icons.Reports />,
    answer: (
      <div className="space-y-2 text-gray-400">
        <p>The <strong>Reports</strong> tab allows you to generate several key reports:</p>
        <ol className="list-decimal list-inside space-y-2 pl-4">
            <li>Navigate to the <strong>Reports</strong> tab from the sidebar.</li>
            <li>Select the type of report you want to generate: <strong>Payroll</strong>, <strong>On Leave</strong>, <strong>Late Arrivals</strong>, or <strong>Absences</strong>.</li>
            <li>Select a <strong>Start Date</strong> and <strong>End Date</strong> for the report period. You can also use the "This Week", "This Month" or "Last Month" quick filters.</li>
            <li>Click <strong>Generate Report</strong>. The data will appear in a table below.</li>
            <li>Once the report appears, click the <strong>Export Report</strong> button to save it as a PDF or CSV file.</li>
        </ol>
      </div>
    ),
  },
    {
    question: 'How do I approve or deny a leave request?',
    icon: <Icons.Leave />,
    answer: (
      <ol className="list-decimal list-inside space-y-2 text-gray-400">
        <li>When an employee requests leave, a notification badge will appear on the <strong>Leave Management</strong> tab.</li>
        <li>Navigate to this tab. You will see a "Pending Leave Requests" section at the top.</li>
        <li>For each request, you can click <strong>Approve</strong> or <strong>Deny</strong>.</li>
        <li>If you click <strong>Approve</strong>, a modal will appear allowing you to confirm or edit the leave end date before finalizing.</li>
        <li>Once approved, the leave is added to the official schedule.</li>
      </ol>
    ),
  },
  {
    question: 'How does the leave recycle bin work?',
    icon: <Icons.Trash />,
    answer: (
      <div className="space-y-2 text-gray-400">
        <p>To prevent accidental data loss, deleted leave entries are first moved to a recycle bin.</p>
        <ol className="list-decimal list-inside space-y-2 pl-4">
          <li>On the <strong>Leave Management</strong> page, click the <strong>Recycle Bin</strong> button.</li>
          <li>A modal will show all soft-deleted leave entries.</li>
          <li>Select one or more entries using the checkboxes.</li>
          <li>Click <strong>Restore Selected</strong> to move them back to the active leave schedule.</li>
          <li>Click <strong>Delete Selected Permanently</strong> or <strong>Empty Recycle Bin</strong> to permanently remove the records. This action cannot be undone.</li>
        </ol>
      </div>
    ),
  },
  {
    question: 'What do the dashboard stats mean?',
    icon: <Icons.Dashboard />,
    answer: (
      <div className="space-y-2 text-gray-400">
        <p>The main dashboard provides a real-time overview of your workforce:</p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li><strong>Total Employees:</strong> The total number of employees in the system.</li>
          <li><strong>Currently On-Site:</strong> The number of employees who are currently clocked in.</li>
          <li><strong>On Leave Today:</strong> The number of employees who are on an approved leave for the current day.</li>
          <li><strong>Absent Today:</strong> The number of employees who are not on-site and not on approved leave. This is calculated as: Total - On-Site - On Leave.</li>
        </ul>
      </div>
    ),
  },
];

const Help: React.FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggleFAQ = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold text-white">Help Center</h1>
                <p className="text-lg text-gray-400 mt-2">Find answers to common questions about using the Sabi Gold Mine Management System.</p>
            </div>
            <div className="space-y-4">
                {faqs.map((faq, index) => (
                    <div key={index} className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden">
                        <button 
                            onClick={() => toggleFAQ(index)}
                            className="w-full flex justify-between items-center p-5 text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className="text-yellow-400">{faq.icon}</div>
                                <span className="text-lg font-semibold text-white">{faq.question}</span>
                            </div>
                            <div className={`transform transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`}>
                               <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </button>
                        <div className={`transition-all duration-500 ease-in-out ${openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                           <div className="p-5 pt-0">
                             <div className="border-t border-gray-700 pt-4">
                               {faq.answer}
                             </div>
                           </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Help;