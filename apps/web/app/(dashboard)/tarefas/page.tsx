// Re-export the existing tasks module so /tarefas route works natively
import TasksPage from '../tasks/page';

export default function TarefasPage() {
  return <TasksPage />;
}
