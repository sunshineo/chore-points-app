import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { email, password, name, inviteCode, registrationSecret } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // If invite code provided, verify it and sign up as KID
    let familyId: string | null = null;
    let role: "PARENT" | "KID" = "PARENT";

    if (inviteCode) {
      const family = await prisma.family.findUnique({
        where: { inviteCode },
      });

      if (!family) {
        return NextResponse.json(
          { error: "Invalid invite code" },
          { status: 400 }
        );
      }

      familyId = family.id;
      role = "KID";
    } else {
      // Parent signup - validate registration secret
      const expectedSecret = process.env.REGISTRATION_SECRET;
      if (expectedSecret && registrationSecret !== expectedSecret) {
        return NextResponse.json(
          { error: "Invalid registration code" },
          { status: 400 }
        );
      }
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role,
        familyId,
      },
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          familyId: user.familyId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
