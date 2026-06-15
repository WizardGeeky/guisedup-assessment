import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Seeding database...");

  // Create test users
  const passwordHash = await bcrypt.hash("password123", 12);

  const alice = await prisma.user.upsert({
    where: { email: "alice@guisedup.com" },
    update: {},
    create: {
      email: "alice@guisedup.com",
      username: "alice_real",
      passwordHash,
      bio: "just a human being trying to figure things out. no filters here.",
      avatarUrl: null,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@guisedup.com" },
    update: {},
    create: {
      email: "bob@guisedup.com",
      username: "bob_unfiltered",
      passwordHash,
      bio: "coffee, code, and honest conversations",
      avatarUrl: null,
    },
  });

  const maya = await prisma.user.upsert({
    where: { email: "maya@guisedup.com" },
    update: {},
    create: {
      email: "maya@guisedup.com",
      username: "maya_wanders",
      passwordHash,
      bio: "solo traveller. introvert. overthinking enthusiast",
      avatarUrl: null,
    },
  });

  console.log(`Created users: ${alice.username}, ${bob.username}, ${maya.username}`);

  // Create posts with authentic text
  const posts = [
    {
      authorId: alice.id,
      text: "i cancelled my plans today to sit by the window and watch it rain. no apologies, it was exactly what i needed.",
      imageUrl: null,
    },
    {
      authorId: alice.id,
      text: "spent 3 hours trying to fix a bug that turned out to be a missing semicolon. the humbling never stops.",
      imageUrl: null,
    },
    {
      authorId: bob.id,
      text: "my dog looked at me with so much judgment when i ate cereal for dinner again. honestly fair.",
      imageUrl: null,
    },
    {
      authorId: bob.id,
      text: "had the most honest conversation with a stranger on a train today. we'll never see each other again and that makes it perfect.",
      imageUrl: null,
    },
    {
      authorId: maya.id,
      text: "solo travel tip: the restaurant that looked too scary to enter alone always has the best food. always.",
      imageUrl: null,
    },
    {
      authorId: maya.id,
      text: "i'm in kyoto and instead of the famous temples i spent 2 hours watching an old man feed pigeons. 10/10 decision.",
      imageUrl: null,
    },
    {
      authorId: alice.id,
      text: "unpopular opinion: being bored is underrated. i've had my best ideas when i had nothing to do.",
      imageUrl: null,
    },
    {
      authorId: bob.id,
      text: "just called my mom for no reason and talked for an hour. that's the whole post.",
      imageUrl: null,
    },
  ];

  for (const postData of posts) {
    const authenticityScore = 0.75 + Math.random() * 0.2; // Simulate authentic posts

    const post = await prisma.post.create({
      data: {
        ...postData,
        authenticityScore,
      },
    });

    // Create embedding jobs for all posts
    await prisma.embeddingJob.upsert({
      where: { postId: post.id },
      update: {},
      create: { postId: post.id },
    });
  }

  console.log(`Created ${posts.length} seed posts`);

  // Create some interactions to seed relationship depth
  const allPosts = await prisma.post.findMany();

  // Alice reacts to Bob's posts
  for (const post of allPosts.filter((p) => p.authorId === bob.id)) {
    await prisma.interaction.upsert({
      where: { userId_postId_type: { userId: alice.id, postId: post.id, type: "REACTION" } },
      update: {},
      create: { userId: alice.id, postId: post.id, type: "REACTION" },
    });
  }

  // Bob views Maya's posts
  for (const post of allPosts.filter((p) => p.authorId === maya.id)) {
    await prisma.interaction.upsert({
      where: { userId_postId_type: { userId: bob.id, postId: post.id, type: "VIEW" } },
      update: {},
      create: { userId: bob.id, postId: post.id, type: "VIEW" },
    });
  }

  console.log("Created seed interactions");
  console.log("\nSeed complete. Test credentials:");
  console.log("  alice@guisedup.com / password123");
  console.log("  bob@guisedup.com / password123");
  console.log("  maya@guisedup.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
