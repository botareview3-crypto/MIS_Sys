import type { GuideStep } from "@/components/guide/GuideSteps";

/**
 * Content for the Local/Intra guide pages. Local now holds real content
 * (2026-09-29); Intra is still placeholder (2026-09-26 template). To edit a
 * guide, change the title/description text below; no other file needs to change.
 *
 * Image + description steps (2026-09-26): each step can optionally carry
 * an `image` — a path under /public/guide/ (e.g. "/guide/local-step-1.png")
 * or a full URL — shown under that step's description. To add a real step
 * image: drop the file in public/guide/ and set `image` to its path, as
 * shown commented-out below. A step with no `image` just renders title +
 * description as before; images are optional per step, not all-or-nothing.
 *
 * IMPORTANT (2026-09-30): admins can now add/delete steps inside the app
 * (Guide page -> "Edit guide"). The first in-app edit copies the whole list
 * into the guide_contents table, and from then on that copy is what people
 * see - edits made to THIS file no longer show up until an admin uses "Reset
 * to built-in content" on the guide page. This file remains the starting
 * point / fallback.
 *
 * Categories (2026-09-29): each step can carry a `category` (e.g. "Cisco").
 * The guide page turns these into filter chips + grouped sections, and the
 * search box searches title, description and category. Use the same spelling
 * for the same group; a new name simply becomes a new group. Steps keep their
 * order-based number no matter how they are grouped.
 */

// Local guide (2026-09-29): built from "PC Configuration 1 - Described" — one step
// per PDF page (step N = PDF page N), 107 steps. Titles are short labels written for
// this page; descriptions are the PDF's own captions. Screenshots live in
// public/guide/local-step-NNN.jpg (a second photo on the same step is -b). Edit, add or
// remove steps freely; steps are numbered automatically by their order here.
export const localGuideSteps: GuideStep[] = [
  {
    title: "Get the PC hostname from the sign-in screen",
    category: "Configuration",
    description: "On the Windows sign-in screen, the \"Sign in to:\" line under the password box shows the PC's hostname (AUC-HQ-000849 in this example). Note it down.",
    image: "/guide/local-step-001-hostname.jpg",
    imageAlt: "Windows sign-in screen with the hostname shown after \"Sign in to:\"",
  },
  {
    title: "Press the startup-options key during reboot",
    category: "Configuration",
    description: "Close-up of the laptop keyboard showing the key combination used to access startup options.",
    image: "/guide/local-step-002.jpg",
  },
  {
    title: "Choose UEFI IPv4 Network in the HP Startup Menu",
    category: "Configuration",
    description: "HP Startup Menu with the UEFI IPv4 Network option selected for network boot.",
    image: "/guide/local-step-004.jpg",
  },
  {
    title: "Wait for network boot to find the server",
    category: "Configuration",
    description: "Network boot begins and the laptop searches for a deployment server.",
    image: "/guide/local-step-005.jpg",
  },
  {
    title: "Check the PXE boot information",
    category: "Configuration",
    description: "PXE boot information is displayed, including the client and server network addresses.",
    image: "/guide/local-step-006.jpg",
  },
  {
    title: "Wait for the deployment environment to load",
    category: "Configuration",
    description: "The Windows deployment environment loads files from the network.",
    image: "/guide/local-step-007.jpg",
  },
  {
    title: "Open the Task Sequence Wizard",
    category: "Configuration",
    description: "Microsoft Task Sequence Wizard showing the available Windows deployment task sequences.",
    image: "/guide/local-step-008.jpg",
  },
  {
    title: "Select the Windows deployment task sequence",
    category: "Configuration",
    description: "Task Sequence Wizard showing the selected deployment option and its configuration details.",
    image: "/guide/local-step-009.jpg",
  },
  {
    // TODO: screenshot to be added by the project owner (e.g.
    // image: "/guide/local-step-hostname-entry.jpg") once the photo is available.
    title: "Enter the hostname for the PC",
    category: "Configuration",
    description: "After clicking Edit on OSDCOMPUTERNAME, enter the hostname for this PC (the one noted in step 1) and continue.",
  },
  {
    title: "Task sequence starts",
    category: "Configuration",
    description: "Microsoft Configuration Manager starts the selected operating-system task sequence.",
    image: "/guide/local-step-010.jpg",
  },
  {
    title: "Let the deployment package download",
    category: "Configuration",
    description: "Configuration Manager continues downloading and applying the deployment package.",
    image: "/guide/local-step-011.jpg",
  },
  {
    title: "Note the deployment warning",
    category: "Configuration",
    description: "A deployment warning appears while Configuration Manager continues processing the task sequence.",
    image: "/guide/local-step-012.jpg",
  },
  {
    title: "Installation progress and restart option",
    category: "Configuration",
    description: "Configuration Manager reports installation progress and offers an option to restart the computer.",
    image: "/guide/local-step-013.jpg",
  },
  {
    title: "HP setup prepares the devices",
    category: "Configuration",
    description: "HP setup screen showing Windows preparing devices after the operating system deployment.",
    image: "/guide/local-step-014.jpg",
  },
  {
    title: "Task sequence resumes after restart",
    category: "Configuration",
    description: "Configuration Manager resumes the task sequence after restart and continues installing components.",
    image: "/guide/local-step-015.jpg",
  },
  {
    title: "Remaining deployment steps apply",
    category: "Configuration",
    description: "The remaining deployment steps are applied while the HP computer completes setup.",
    image: "/guide/local-step-016.jpg",
  },
  {
    title: "Windows checks for updates",
    category: "Configuration",
    description: "Windows first-run setup checks online for updates.",
    image: "/guide/local-step-017.jpg",
  },
  {
    title: "Wait for the update check to finish",
    category: "Configuration",
    description: "The update check continues before the Windows sign-in screen becomes available.",
    image: "/guide/local-step-018.jpg",
  },
  {
    title: "Choose Other user on the sign-in screen",
    category: "Configuration",
    description: "Windows sign-in screen showing the Support AAD and Other user account choices.",
    image: "/guide/local-step-019.jpg",
    images: ["/guide/local-step-019-b.jpg"],
  },
  {
    title: "Enter the organization account credentials",
    category: "Configuration",
    description: "Other user sign-in form where the organization account credentials are entered.",
    image: "/guide/local-step-020.jpg",
  },
  {
    title: "Open the deployment file server",
    category: "Configuration",
    description: "Windows Run dialog used to open the deployment file server by its network address.",
    image: "/guide/local-step-021.jpg",
  },
  {
    title: "Browse the shared folders",
    category: "Configuration",
    description: "File Explorer opens the deployment server and displays its shared folders.",
    image: "/guide/local-step-022.jpg",
  },
  {
    title: "Open the Cisco Secure Client folder",
    category: "Cisco",
    description: "The Cisco Secure Client deployment folder is opened and its installation files are shown.",
    image: "/guide/local-step-023.jpg",
  },
  {
    title: "Run the Cisco Secure Client installer",
    category: "Cisco",
    description: "Windows security warning for the Cisco Secure Client installer; select Run to continue.",
    image: "/guide/local-step-024.jpg",
  },
  {
    title: "Cisco Secure Client setup welcome",
    category: "Cisco",
    description: "Cisco Secure Client setup wizard welcome page ready to start installation.",
    image: "/guide/local-step-025.jpg",
  },
  {
    title: "Accept the license agreement",
    category: "Cisco",
    description: "Cisco Secure Client end-user license agreement; accept the terms to proceed.",
    image: "/guide/local-step-026.jpg",
  },
  {
    title: "Confirm the destination and install",
    category: "Cisco",
    description: "Cisco Secure Client setup confirms the destination and is ready to install.",
    image: "/guide/local-step-027.jpg",
  },
  {
    title: "Approve the User Account Control prompt",
    category: "Cisco",
    description: "Windows User Account Control asks permission for Cisco Secure Client to make changes.",
    image: "/guide/local-step-028.jpg",
  },
  {
    title: "Wait for the Cisco installation",
    category: "Cisco",
    description: "Cisco Secure Client installation progress window while files are copied and configured.",
    image: "/guide/local-step-029.jpg",
  },
  {
    title: "Return to the Cisco installation folder",
    category: "Cisco",
    description: "File Explorer returns to the Cisco installation folder after setup completes.",
    image: "/guide/local-step-030.jpg",
  },
  {
    title: "Open the Cisco configuration text file",
    category: "Cisco",
    description: "A Cisco Secure Client text or configuration file is opened so its contents can be copied.",
    image: "/guide/local-step-031.jpg",
  },
  {
    title: "Open a new File Explorer tab",
    category: "Cisco",
    description: "A new File Explorer tab is opened to navigate to the local Cisco program folder.",
    image: "/guide/local-step-032.jpg",
  },
  {
    title: "Start from File Explorer Home",
    category: "Cisco",
    description: "File Explorer Home view used as the starting point for local-folder navigation.",
    image: "/guide/local-step-033.jpg",
  },
  {
    title: "Open the local Cisco Secure Client folder",
    category: "Cisco",
    description: "The local Cisco Secure Client folder is opened under ProgramData.",
    image: "/guide/local-step-034.jpg",
  },
  {
    title: "Open the ISE Posture subfolder",
    category: "Cisco",
    description: "The ISE Posture subfolder is opened within the Cisco Secure Client directory.",
    image: "/guide/local-step-035.jpg",
  },
  {
    title: "Check the ISE Posture destination folder",
    category: "Cisco",
    description: "The destination ISE Posture folder is displayed before adding the required configuration files.",
    image: "/guide/local-step-036.jpg",
  },
  {
    title: "Open the source folder in a new tab",
    category: "Cisco",
    description: "A new tab returns to the network source folder to locate the ISE Posture files.",
    image: "/guide/local-step-037.jpg",
  },
  {
    title: "Select the ISE Posture files and copy",
    category: "Cisco",
    description: "The required ISE Posture files are selected and the context menu is opened for copying.",
    image: "/guide/local-step-038.jpg",
  },
  {
    title: "Reopen the local ISE Posture folder",
    category: "Cisco",
    description: "The local ISE Posture folder is reopened as the destination for the copied files.",
    image: "/guide/local-step-039.jpg",
  },
  {
    title: "Approve administrator access to paste",
    category: "Cisco",
    description: "Windows requests administrator approval to copy files into the protected program folder.",
    image: "/guide/local-step-040.jpg",
  },
  {
    title: "Confirm the protected-folder copy",
    category: "Cisco",
    description: "User Account Control asks permission for File Explorer to complete the protected-folder copy.",
    image: "/guide/local-step-041.jpg",
  },
  {
    title: "Check the copied files",
    category: "Cisco",
    description: "The copied ISE Posture configuration files are now visible in the destination folder.",
    image: "/guide/local-step-042.jpg",
  },
  {
    title: "Open the small configuration file",
    category: "Cisco",
    description: "A small configuration file is opened to verify or edit its contents.",
    image: "/guide/local-step-043.jpg",
  },
  {
    title: "Select the configuration text",
    category: "Cisco",
    description: "The configuration text is selected so it can be copied or replaced as required.",
    image: "/guide/local-step-044.jpg",
  },
  {
    title: "Check the updated configuration files",
    category: "Cisco",
    description: "File Explorer shows the updated configuration files in the ISE Posture folder.",
    image: "/guide/local-step-045.jpg",
  },
  {
    title: "Select both posture files",
    category: "Cisco",
    description: "Both posture-related files are selected in preparation for the next copy or verification step.",
    image: "/guide/local-step-046.jpg",
  },
  {
    title: "Confirm the selected files",
    category: "Cisco",
    description: "The selected files remain highlighted, confirming the correct Cisco posture items.",
    image: "/guide/local-step-047.jpg",
  },
  {
    title: "Open the Umbrella destination folder",
    category: "Cisco",
    description: "A clean destination folder is opened for the Cisco Umbrella files.",
    image: "/guide/local-step-048.jpg",
  },
  {
    title: "Select the Umbrella files and copy",
    category: "Cisco",
    description: "The Umbrella installation files are selected and the copy action is chosen.",
    image: "/guide/local-step-049.jpg",
  },
  {
    title: "Open the local Umbrella folder",
    category: "Cisco",
    description: "The local Umbrella folder is shown before the selected files are added.",
    image: "/guide/local-step-050.jpg",
  },
  {
    title: "Approve administrator access to paste",
    category: "Cisco",
    description: "Windows requests administrator permission to copy files into the Umbrella folder.",
    image: "/guide/local-step-051.jpg",
  },
  {
    title: "Check the Umbrella files",
    category: "Cisco",
    description: "The Umbrella files appear in the destination folder after the copy completes.",
    image: "/guide/local-step-052.jpg",
  },
  {
    title: "Return to the deployment server",
    category: "SAP",
    description: "File Explorer returns to the deployment server and displays the available software folders.",
    image: "/guide/local-step-053.jpg",
  },
  {
    title: "Select the SAP GUI folder",
    category: "SAP",
    description: "The SAP GUI shared-software folder is selected on the network server.",
    image: "/guide/local-step-054.jpg",
  },
  {
    title: "Locate the SAP GUI installer",
    category: "SAP",
    description: "The SAP GUI installer executable is shown inside the selected shared folder.",
    image: "/guide/local-step-055.jpg",
  },
  {
    title: "Run the SAP installer",
    category: "SAP",
    description: "Windows security warning for the SAP installer; select Run to launch it.",
    image: "/guide/local-step-056.jpg",
  },
  {
    title: "Wait for SAP to prepare its files",
    category: "SAP",
    description: "The SAP installation package begins extracting or preparing its setup files.",
    image: "/guide/local-step-057.jpg",
  },
  {
    title: "Approve the User Account Control prompt",
    category: "SAP",
    description: "User Account Control asks permission for the SAP installer to make changes.",
    image: "/guide/local-step-058.jpg",
  },
  {
    title: "SAP Front-End Installer welcome",
    category: "SAP",
    description: "SAP Front-End Installer welcome page for installing SAP GUI for Windows.",
    image: "/guide/local-step-059.jpg",
  },
  {
    title: "Review the available components",
    category: "SAP",
    description: "SAP Front-End Installer shows the available components and installation details.",
    image: "/guide/local-step-060.jpg",
  },
  {
    title: "Select the required SAP GUI components",
    category: "SAP",
    description: "The required SAP GUI components are selected in the feature list.",
    image: "/guide/local-step-061.jpg",
  },
  {
    title: "Review the installation summary",
    category: "SAP",
    description: "SAP installation summary confirms the selected components and destination.",
    image: "/guide/local-step-062.jpg",
  },
  {
    title: "Wait for the SAP installation",
    category: "SAP",
    description: "SAP Front-End Installer copies and configures the selected components.",
    image: "/guide/local-step-063.jpg",
  },
  {
    title: "SAP installation completes",
    category: "SAP",
    description: "SAP Front-End Installer reports that the installation completed successfully.",
    image: "/guide/local-step-064.jpg",
  },
  {
    title: "Open Microsoft Edge",
    category: "Applications to be installed",
    description: "Microsoft Edge opens after installation, showing the first-run welcome screen.",
    image: "/guide/local-step-065.jpg",
  },
  {
    title: "Open the African Union web portal",
    category: "Applications to be installed",
    description: "Edge address bar is used to open the organization's African Union web portal.",
    image: "/guide/local-step-066.jpg",
  },
  {
    title: "SAP NetWeaver sign-in page loads",
    category: "Applications to be installed",
    description: "The SAP NetWeaver sign-in page loads in Microsoft Edge.",
    image: "/guide/local-step-067.jpg",
  },
  {
    title: "Open the Edge menu",
    category: "Applications to be installed",
    description: "The Edge menu is opened to access browser tools and installation options.",
    image: "/guide/local-step-068.jpg",
  },
  {
    title: "Find the Apps menu",
    category: "Applications to be installed",
    description: "Edge Apps menu is highlighted as the route for installing the web portal as an app.",
    image: "/guide/local-step-069.jpg",
  },
  {
    title: "Keep the menu open",
    category: "Applications to be installed",
    description: "The browser menu remains open while navigating to the app-install command.",
    image: "/guide/local-step-070.jpg",
  },
  {
    title: "Expand the Apps submenu",
    category: "Applications to be installed",
    description: "The Apps submenu is expanded to show the option for installing the current site.",
    image: "/guide/local-step-071.jpg",
  },
  {
    title: "Open a new browser tab",
    category: "Applications to be installed",
    description: "A new browser tab is opened to continue configuring the portal shortcut.",
    image: "/guide/local-step-072.jpg",
  },
  {
    title: "Enter the desktop portal address",
    category: "Applications to be installed",
    description: "The organization desktop portal address is entered in the browser.",
    image: "/guide/local-step-073.jpg",
  },
  {
    title: "Confirm the portal opens",
    category: "Applications to be installed",
    description: "The portal opens in a dedicated browser window, confirming the address works.",
    image: "/guide/local-step-074.jpg",
  },
  {
    title: "Open Settings and more",
    category: "Applications to be installed",
    description: "Edge Settings and more menu is opened from the portal window.",
    image: "/guide/local-step-075.jpg",
  },
  {
    title: "Find the Apps options",
    category: "Applications to be installed",
    description: "The browser menu shows Apps and related options for creating a site application.",
    image: "/guide/local-step-076.jpg",
  },
  {
    title: "Select the Apps submenu",
    category: "Applications to be installed",
    description: "The Apps submenu is selected from the Edge menu.",
    image: "/guide/local-step-077.jpg",
  },
  {
    title: "Choose Install this site as an app",
    category: "Applications to be installed",
    description: "Install this site as an app is selected from the browser's Apps submenu.",
    image: "/guide/local-step-078.jpg",
  },
  {
    title: "Install the MIS Division Desktop app",
    category: "Applications to be installed",
    description: "Installation dialog names the MIS Division Desktop web app and offers Install or Cancel.",
    image: "/guide/local-step-079.jpg",
  },
  {
    title: "Allow shortcuts and startup",
    category: "Applications to be installed",
    description: "The newly installed web app requests permission for shortcuts and startup behavior.",
    image: "/guide/local-step-080.jpg",
  },
  {
    title: "Review the installed confirmation",
    category: "Applications to be installed",
    description: "The app-installed confirmation is reviewed and the preferred launch options are selected.",
    image: "/guide/local-step-081.jpg",
  },
  {
    title: "Pin or launch the app",
    category: "Applications to be installed",
    description: "Windows confirms the MIS Division Desktop app installation and offers to pin or launch it.",
    image: "/guide/local-step-082.jpg",
  },
  {
    title: "Check the Start menu",
    category: "Applications to be installed",
    description: "Windows Start menu shows the newly available applications and shortcuts.",
    image: "/guide/local-step-083.jpg",
  },
  {
    title: "Pin the app to Start or the taskbar",
    category: "Applications to be installed",
    description: "The Start menu context menu is used to pin the new app to Start or the taskbar.",
    image: "/guide/local-step-084.jpg",
  },
  {
    title: "Open the Start Menu Programs folder",
    category: "Applications to be installed",
    description: "File Explorer opens the Windows Start Menu Programs folder.",
    image: "/guide/local-step-085.jpg",
  },
  {
    title: "Locate the app shortcut",
    category: "Applications to be installed",
    description: "The application shortcut is located among the installed Start Menu programs.",
    image: "/guide/local-step-086.jpg",
  },
  {
    title: "Press the Windows-key shortcut",
    category: "Configuration",
    description: "Close-up of the keyboard showing the shortcut used to continue system configuration.",
    image: "/guide/local-step-087.jpg",
  },
  {
    title: "Confirm the shortcut",
    category: "Configuration",
    description: "A second keyboard close-up confirms the Windows-key shortcut being pressed.",
    image: "/guide/local-step-088.jpg",
  },
  {
    title: "Check the local system folders",
    category: "Configuration",
    description: "File Explorer displays the local system folders after using the keyboard shortcut.",
    image: "/guide/local-step-089.jpg",
  },
  {
    title: "Return to the Other user sign-in",
    category: "Configuration",
    description: "Windows sign-in screen returns to the Other user account entry form.",
    image: "/guide/local-step-090.jpg",
    images: ["/guide/local-step-090-b.jpg"],
  },
  {
    title: "Enter the organization credentials",
    category: "Configuration",
    description: "Organization account credentials are entered on the Other user sign-in screen.",
    image: "/guide/local-step-091.jpg",
  },
  {
    title: "Windows desktop appears",
    category: "Configuration",
    description: "Windows desktop appears after successful sign-in to the organization account.",
    image: "/guide/local-step-092.jpg",
  },
  {
    title: "Open Settings from Start",
    category: "Configuration",
    description: "Windows Start menu is opened and Settings is selected.",
    image: "/guide/local-step-093.jpg",
  },
  {
    title: "Windows Settings home",
    category: "Configuration",
    description: "Windows Settings home page shows the signed-in user and main configuration categories.",
    image: "/guide/local-step-094.jpg",
  },
  {
    title: "Confirm the user profile",
    category: "Configuration",
    description: "Settings account page confirms the user profile and organization identity.",
    image: "/guide/local-step-095.jpg",
  },
  {
    title: "Open Access work or school",
    category: "Configuration",
    description: "Accounts settings menu includes the Access work or school option.",
    image: "/guide/local-step-096.jpg",
  },
  {
    title: "Review the connected account",
    category: "Configuration",
    description: "Access work or school page displays the connected organization account.",
    image: "/guide/local-step-097.jpg",
  },
  {
    title: "Expand the connected work account",
    category: "Configuration",
    description: "The connected work account is expanded to show its Connect, Info, and related controls.",
    image: "/guide/local-step-098.jpg",
  },
  {
    title: "Open the connection details",
    category: "Configuration",
    description: "Work-account connection details are opened for device management information.",
    image: "/guide/local-step-099.jpg",
  },
  {
    title: "Check device management information",
    category: "Configuration",
    description: "Device management connection information shows the management server and synchronization status.",
    image: "/guide/local-step-100.jpg",
  },
  {
    title: "Review the device sync status",
    category: "Configuration",
    description: "The connection information shows the management server address and device sync status. The screenshot shows a warning that the last sync was not fully successful because credentials could not be verified.",
    image: "/guide/local-step-101.jpg",
  },
  {
    title: "Search for Settings",
    category: "Configuration",
    description: "Windows Start search is used to find Settings and system tools.",
    image: "/guide/local-step-102.jpg",
  },
  {
    title: "Open Windows Update",
    category: "Configuration",
    description: "Windows Settings navigation opens the Windows Update section.",
    image: "/guide/local-step-103.jpg",
  },
  {
    title: "Start the update check",
    category: "Configuration",
    description: "Windows Update page is opened and the system begins checking for available updates.",
    image: "/guide/local-step-104.jpg",
  },
  {
    title: "Wait for the update check",
    category: "Configuration",
    description: "Windows Update actively checks Microsoft services for current updates.",
    image: "/guide/local-step-105.jpg",
  },
  {
    title: "Review the available updates",
    category: "Configuration",
    description: "Windows Update lists available or recently installed updates after the check completes.",
    image: "/guide/local-step-106.jpg",
  },
  {
    title: "Final update review",
    category: "Configuration",
    description: "Final Windows Update review shows the update history and confirms the computer's current update state.",
    image: "/guide/local-step-107.jpg",
  },
];

export const intraGuideSteps: GuideStep[] = [
  {
    title: "Step 1",
    description: "Placeholder — replace with the first Intra step.",
    // image: "/guide/intra-step-1.png",
  },
  { title: "Step 2", description: "Placeholder — replace with the second Intra step." },
  { title: "Step 3", description: "Placeholder — replace with the third Intra step." },
];
