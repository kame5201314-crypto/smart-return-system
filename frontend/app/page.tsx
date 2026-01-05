import { redirect } from "next/navigation";

export default function Home() {
  // 首頁重定向到素材管理
  redirect("/assets");
}
