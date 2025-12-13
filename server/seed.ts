import { storage } from "./storage";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create sample clients
  const sarah = await storage.createClient({
    name: "Sarah Miller",
    email: "sarah@example.com",
    status: "active",
    mobileAppConnected: 1,
  });

  const david = await storage.createClient({
    name: "David Chen",
    email: "david@example.com",
    status: "active",
    mobileAppConnected: 0,
  });

  const elena = await storage.createClient({
    name: "Elena Rodriguez",
    email: "elena@example.com",
    status: "active",
    mobileAppConnected: 0,
  });

  const marcus = await storage.createClient({
    name: "Marcus Johnson",
    email: "marcus@example.com",
    status: "active",
    mobileAppConnected: 0,
  });

  console.log("✅ Created clients");

  // Create sample messages for Sarah
  await storage.createMessage({
    clientId: sarah.id,
    role: "ai",
    content: "Hi Sarah. I noticed you were feeling a bit stuck in our last session regarding the team restructure. How is that sitting with you today?",
    type: "text",
  });

  await storage.createMessage({
    clientId: sarah.id,
    role: "user",
    content: "I'm still feeling overwhelmed. There's so much to do and I don't know where to start.",
    type: "text",
  });

  await storage.createMessage({
    clientId: sarah.id,
    role: "ai",
    content: "That sounds heavy. When you say you feel 'responsible' for their reaction, what does that responsibility look like to you?",
    type: "text",
  });

  console.log("✅ Created messages");

  // Create sample insights for Sarah
  await storage.createInsight({
    clientId: sarah.id,
    category: "Emotional Spike",
    title: "Anxiety regarding Board Meeting",
    description: "Sarah expressed high anxiety (8/10) about the upcoming Q3 presentation. Used words like 'trapped', 'unprepared', and 'fake'.",
  });

  await storage.createInsight({
    clientId: sarah.id,
    category: "Recurring Theme",
    title: "The 'Rescuer' Pattern",
    description: "Third mention this week of stepping in to fix a junior engineer's code late at night. Contradicts her goal of 'stepping back'.",
  });

  await storage.createInsight({
    clientId: sarah.id,
    category: "Shift",
    title: "Perspective Change on Hiring",
    description: "Showed openness to hiring a senior lead, previously was resistant. Acknowledged she 'can't be everywhere'.",
  });

  console.log("✅ Created insights");

  // Create sentiment data for Sarah
  const sentimentDays = [
    { date: "Mon", sentiment: 45, intensity: 30 },
    { date: "Tue", sentiment: 35, intensity: 60 },
    { date: "Wed", sentiment: 60, intensity: 40 },
    { date: "Thu", sentiment: 75, intensity: 20 },
    { date: "Fri", sentiment: 65, intensity: 35 },
    { date: "Sat", sentiment: 80, intensity: 25 },
    { date: "Sun", sentiment: 70, intensity: 30 },
  ];

  for (const day of sentimentDays) {
    await storage.createSentimentData({
      clientId: sarah.id,
      date: day.date,
      sentimentScore: day.sentiment,
      intensityScore: day.intensity,
    });
  }

  console.log("✅ Created sentiment data");
  console.log("🎉 Database seeded successfully!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
