
"use client";
import { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";

export default function Page() {
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    async function getTodos() {
      const { data: todos, error } = await supabase.from("todos").select();
      if (error) {
        console.error("Erro ao buscar todos:", error);
        return;
      }
      if (todos && todos.length > 0) {
        setTodos(todos);
      }
    }
    getTodos();
  }, []);

  return (
    <div>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id || todo}>{todo.title || JSON.stringify(todo)}</li>
        ))}
      </ul>
    </div>
  );
}
