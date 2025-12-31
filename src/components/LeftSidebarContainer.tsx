// // 'use client';

// import { useState } from 'react';
// import ProjectsView, { Project } from './ProjectsView';
// import FilesSidebar from './FilesSidebar';

// interface ContextDoc {
//   id: string;
//   title: string;
//   content: string;
//   type: 'character' | 'plot' | 'worldbuilding' | 'other';
// }

// interface LeftSidebarContainerProps {
//   // Projects
//   projects: Project[];
//   currentProjectId?: string;
//   onProjectSelect: (projectId: string) => void;
//   onProjectCreate: (name: string, description?: string) => void;
//   onProjectDelete: (projectId: string) => void;
  
//   // Files (for current project)
//   docs: ContextDoc[];
//   selectedDocId?: string;
//   onDocAdd: (doc: Omit<ContextDoc, 'id'>) => void;
//   onDocDelete: (id: string) => void;
//   onDocSelect: (id: string) => void;
// }

// export default function LeftSidebarContainer({
//   projects,
//   currentProjectId,
//   onProjectSelect,
//   onProjectCreate,
//   onProjectDelete,
//   docs,
//   selectedDocId,
//   onDocAdd,
//   onDocDelete,
//   onDocSelect
// }: LeftSidebarContainerProps) {
//   const [view, setView] = useState<'projects' | 'files'>('files');

//   const currentProject = projects.find(p => p.id === currentProjectId);

//   return (
//     <div 
//       className="h-full flex flex-col"
//       style={{ background: 'var(--sidebar-bg)' }}
//     >
//       {/* Tab Switcher */}
//       <div 
//         className="flex border-b"
//         style={{ 
//           background: 'var(--sidebar-bg)',
//           borderColor: 'var(--border-main)'
//         }}
//       >
//         <button
//           onClick={() => setView('projects')}
//           className="flex-1 py-3 px-4 text-sm font-medium transition-colors relative"
//           style={{
//             color: view === 'projects' ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)'
//           }}
//           onMouseEnter={(e) => {
//             if (view !== 'projects') {
//               e.currentTarget.style.background = 'var(--sidebar-item-hover)';
//             }
//           }}
//           onMouseLeave={(e) => {
//             if (view !== 'projects') {
//               e.currentTarget.style.background = 'transparent';
//             }
//           }}
//         >
//           📁 Projects
//           {view === 'projects' && (
//             <div 
//               className="absolute bottom-0 left-0 right-0 h-0.5"
//               style={{ background: 'var(--btn-primary-bg)' }}
//             ></div>
//           )}
//         </button>
//         <button
//           onClick={() => setView('files')}
//           className="flex-1 py-3 px-4 text-sm font-medium transition-colors relative"
//           style={{
//             color: view === 'files' ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)'
//           }}
//           onMouseEnter={(e) => {
//             if (view !== 'files') {
//               e.currentTarget.style.background = 'var(--sidebar-item-hover)';
//             }
//           }}
//           onMouseLeave={(e) => {
//             if (view !== 'files') {
//               e.currentTarget.style.background = 'transparent';
//             }
//           }}
//         >
//           📄 Files
//           {view === 'files' && (
//             <div 
//               className="absolute bottom-0 left-0 right-0 h-0.5"
//               style={{ background: 'var(--btn-primary-bg)' }}
//             ></div>
//           )}
//         </button>
//       </div>

//       {/* Current Project Indicator (when in Files view) */}
//       {view === 'files' && currentProject && (
//         <div 
//           className="px-4 py-2 border-b flex items-center justify-between"
//           style={{
//             background: 'var(--editor-bg)',
//             borderColor: 'var(--border-main)'
//           }}
//         >
//           <span 
//             className="text-xs truncate"
//             style={{ color: 'var(--sidebar-text-muted)' }}
//           >
//             📂 {currentProject.name}
//           </span>
//           <button
//             onClick={() => setView('projects')}
//             className="text-xs font-medium transition-colors"
//             style={{ color: 'var(--btn-primary-bg)' }}
//             onMouseEnter={(e) => {
//               e.currentTarget.style.color = 'var(--btn-primary-hover)';
//             }}
//             onMouseLeave={(e) => {
//               e.currentTarget.style.color = 'var(--btn-primary-bg)';
//             }}
//           >
//             Switch
//           </button>
//         </div>
//       )}

//       {/* Content */}
//       <div className="flex-1 overflow-hidden">
//         {view === 'projects' ? (
//           <ProjectsView
//             projects={projects}
//             currentProjectId={currentProjectId}
//             onProjectSelect={onProjectSelect}
//             onProjectCreate={onProjectCreate}
//             onProjectDelete={onProjectDelete}
//           />
//         ) : (
//           currentProject ? (
//             <FilesSidebar
//               docs={docs}
//               selectedId={selectedDocId}
//               onAdd={onDocAdd}
//               onDelete={onDocDelete}
//               onSelect={onDocSelect}
//             />
//           ) : (
//             <div className="h-full flex items-center justify-center p-8 text-center">
//               <div>
//                 <div className="text-4xl mb-3">📁</div>
//                 <p 
//                   className="text-sm mb-2"
//                   style={{ color: 'var(--sidebar-text-muted)' }}
//                 >
//                   No project selected
//                 </p>
//                 <button
//                   onClick={() => setView('projects')}
//                   className="text-sm font-medium transition-colors"
//                   style={{ color: 'var(--btn-primary-bg)' }}
//                   onMouseEnter={(e) => {
//                     e.currentTarget.style.color = 'var(--btn-primary-hover)';
//                   }}
//                   onMouseLeave={(e) => {
//                     e.currentTarget.style.color = 'var(--btn-primary-bg)';
//                   }}
//                 >
//                   → Create or select a project
//                 </button>
//               </div>
//             </div>
//           )
//         )}
//       </div>
//     </div>
//   );
// }