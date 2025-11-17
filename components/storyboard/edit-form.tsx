"use client";

import React from "react";
import { useRouter } from "next/navigation";
import StoryboardProjectView from "./project-view";

interface EditFormProps {
  projectId: string;
}

export default function StoryboardEditForm({ projectId }: EditFormProps) {
  // 编辑表单可以复用项目查看组件，或者创建独立的编辑组件
  // 这里先简单返回项目查看组件
  return <StoryboardProjectView projectId={projectId} />;
}

