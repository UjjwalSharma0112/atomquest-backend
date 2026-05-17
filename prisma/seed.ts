import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'


dotenv.config()
const prisma = new PrismaClient()

async function main() {
  console.log('¿? Seeding AtomQuest...')

  await prisma.auditLog.deleteMany()
  await prisma.checkIn.deleteMany()
  await prisma.approval.deleteMany()
  await prisma.goalShare.deleteMany()
  await prisma.goal.deleteMany()
  await prisma.cycle.deleteMany()
  await prisma.user.deleteMany()

  const adminPw    = await bcrypt.hash('admin123', 10)
  const managerPw  = await bcrypt.hash('manager123', 10)
  const employeePw = await bcrypt.hash('employee123', 10)

  const admin = await prisma.user.create({
    data: {
      name: 'Priya Sharma',
      email: 'admin@test.com',
      password: adminPw,
      role: 'ADMIN',
    }
  })

  const manager1 = await prisma.user.create({
    data: {
      name: 'Rahul Mehta',
      email: 'manager@test.com',
      password: managerPw,
      role: 'MANAGER',
    }
  })

  const manager2 = await prisma.user.create({
    data: {
      name: 'Sneha Kapoor',
      email: 'manager2@test.com',
      password: managerPw,
      role: 'MANAGER',
    }
  })

  const emp1 = await prisma.user.create({
    data: {
      name: 'Arjun Verma',
      email: 'employee@test.com',
      password: employeePw,
      role: 'EMPLOYEE',
      managerId: manager1.id,
    }
  })

  const emp2 = await prisma.user.create({
    data: {
      name: 'Divya Nair',
      email: 'divya@test.com',
      password: employeePw,
      role: 'EMPLOYEE',
      managerId: manager1.id,
    }
  })

  const emp3 = await prisma.user.create({
    data: {
      name: 'Karan Joshi',
      email: 'karan@test.com',
      password: employeePw,
      role: 'EMPLOYEE',
      managerId: manager2.id,
    }
  })

  const emp4 = await prisma.user.create({
    data: {
      name: 'Meera Pillai',
      email: 'meera@test.com',
      password: employeePw,
      role: 'EMPLOYEE',
      managerId: manager2.id,
    }
  })

  console.log('¿? Users created')

  const cycle2025GS = await prisma.cycle.create({
    data: {
      year: 2025,
      phase: 'GOAL_SETTING',
      windowOpen:  new Date('2025-04-01T00:00:00Z'),
      windowClose: new Date('2025-04-30T23:59:59Z'),
    }
  })

  const cycle2025Q1 = await prisma.cycle.create({
    data: {
      year: 2025,
      phase: 'Q1',
      windowOpen:  new Date('2025-07-01T00:00:00Z'),
      windowClose: new Date('2025-07-31T23:59:59Z'),
    }
  })

  const cycle2025Q2 = await prisma.cycle.create({
    data: {
      year: 2025,
      phase: 'Q2',
      windowOpen:  new Date('2025-10-01T00:00:00Z'),
      windowClose: new Date('2025-10-31T23:59:59Z'),
    }
  })

  const cycle2026GS = await prisma.cycle.create({
    data: {
      year: 2026,
      phase: 'GOAL_SETTING',
      windowOpen:  new Date('2026-04-01T00:00:00Z'),
      windowClose: new Date('2026-12-31T23:59:59Z'),
    }
  })

  console.log('¿? Cycles created')

  const arjunG1 = await prisma.goal.create({
    data: {
      employeeId: emp1.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Revenue Growth',
      title: 'Increase quarterly sales revenue',
      description: 'Achieve 20% growth in Q2 sales through new client acquisition and upselling.',
      uomType: 'MIN',
      target: 5000000,
      weightage: 35,
      status: 'APPROVED',
      isLocked: true,
    }
  })

  const arjunG2 = await prisma.goal.create({
    data: {
      employeeId: emp1.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Customer Success',
      title: 'Improve customer satisfaction score',
      description: 'Raise NPS from 62 to 75 through proactive support and onboarding improvements.',
      uomType: 'MIN',
      target: 75,
      weightage: 25,
      status: 'APPROVED',
      isLocked: true,
    }
  })

  const arjunG3 = await prisma.goal.create({
    data: {
      employeeId: emp1.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Operational Efficiency',
      title: 'Reduce lead response time',
      description: 'Cut average lead response time from 48 hours to under 12 hours.',
      uomType: 'MAX',
      target: 12,
      weightage: 20,
      status: 'APPROVED',
      isLocked: true,
    }
  })

  const arjunG4 = await prisma.goal.create({
    data: {
      employeeId: emp1.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Learning & Development',
      title: 'Complete AWS Solutions Architect certification',
      description: 'Pass the AWS SAA-C03 exam by end of Q3.',
      uomType: 'TIMELINE',
      target: 1,
      weightage: 10,
      status: 'APPROVED',
      isLocked: true,
      deadline: new Date('2026-09-30T00:00:00Z'),
    }
  })

  const arjunG5 = await prisma.goal.create({
    data: {
      employeeId: emp1.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Quality',
      title: 'Zero critical production incidents',
      description: 'Maintain zero Sev-1 incidents in owned services through Q4.',
      uomType: 'ZERO',
      target: 0,
      weightage: 10,
      status: 'APPROVED',
      isLocked: true,
    }
  })

  const divyaG1 = await prisma.goal.create({
    data: {
      employeeId: emp2.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Product Development',
      title: 'Ship mobile app v2.0',
      description: 'Deliver redesigned mobile experience with offline mode and push notifications.',
      uomType: 'TIMELINE',
      target: 1,
      weightage: 40,
      status: 'APPROVED',
      isLocked: true,
      deadline: new Date('2026-08-31T00:00:00Z'),
    }
  })

  const divyaG2 = await prisma.goal.create({
    data: {
      employeeId: emp2.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Quality',
      title: 'Reduce bug backlog by 60%',
      description: 'Clear 60% of existing P1/P2 bugs in JIRA within the cycle.',
      uomType: 'MIN',
      target: 60,
      weightage: 30,
      status: 'APPROVED',
      isLocked: true,
    }
  })

  const divyaG3 = await prisma.goal.create({
    data: {
      employeeId: emp2.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Team Collaboration',
      title: 'Conduct 12 knowledge-sharing sessions',
      description: 'Host monthly tech talks and bi-weekly pair programming sessions.',
      uomType: 'MIN',
      target: 12,
      weightage: 20,
      status: 'APPROVED',
      isLocked: true,
    }
  })

  const divyaG4 = await prisma.goal.create({
    data: {
      employeeId: emp2.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Cost Optimisation',
      title: 'Reduce cloud infrastructure spend',
      description: 'Cut AWS spend by 15% through rightsizing and reserved instances.',
      uomType: 'MAX',
      target: 85,
      weightage: 10,
      status: 'APPROVED',
      isLocked: true,
    }
  })

  const karanG1 = await prisma.goal.create({
    data: {
      employeeId: emp3.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Revenue Growth',
      title: 'Onboard 15 enterprise clients',
      description: 'Expand enterprise tier by acquiring 15 new clients through partnerships.',
      uomType: 'MIN',
      target: 15,
      weightage: 40,
      status: 'PENDING_APPROVAL',
      isLocked: false,
    }
  })

  const karanG2 = await prisma.goal.create({
    data: {
      employeeId: emp3.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Marketing',
      title: 'Grow LinkedIn page to 10k followers',
      description: 'Increase brand awareness through consistent content and campaigns.',
      uomType: 'MIN',
      target: 10000,
      weightage: 30,
      status: 'PENDING_APPROVAL',
      isLocked: false,
    }
  })

  const karanG3 = await prisma.goal.create({
    data: {
      employeeId: emp3.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Partnerships',
      title: 'Sign 3 strategic partnership agreements',
      description: 'Close partnership deals with at least 3 SaaS vendors.',
      uomType: 'MIN',
      target: 3,
      weightage: 30,
      status: 'PENDING_APPROVAL',
      isLocked: false,
    }
  })

  await prisma.goal.create({
    data: {
      employeeId: emp4.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'HR & Culture',
      title: 'Reduce employee attrition to below 8%',
      description: 'Implement retention programs and improve engagement scores.',
      uomType: 'MAX',
      target: 8,
      weightage: 50,
      status: 'DRAFT',
      isLocked: false,
    }
  })

  await prisma.goal.create({
    data: {
      employeeId: emp4.id,
      cycleId: cycle2026GS.id,
      thrustArea: 'Recruitment',
      title: 'Hire 20 engineers by Q3',
      description: 'Scale engineering team to support product roadmap.',
      uomType: 'MIN',
      target: 20,
      weightage: 30,
      status: 'DRAFT',
      isLocked: false,
    }
  })

  console.log('¿? Goals created')

  await prisma.approval.create({
    data: {
      goalId: arjunG1.id,
      managerId: manager1.id,
      action: 'APPROVED',
      comment: 'Strong target aligned with company OKRs. Go for it!',
    }
  })
  await prisma.approval.create({
    data: {
      goalId: arjunG2.id,
      managerId: manager1.id,
      action: 'APPROVED',
      comment: 'NPS improvement is critical this quarter. Approved.',
    }
  })
  await prisma.approval.create({
    data: {
      goalId: arjunG3.id,
      managerId: manager1.id,
      action: 'APPROVED',
      comment: 'Response time reduction will directly impact conversion. Approved.',
    }
  })
  await prisma.approval.create({
    data: {
      goalId: arjunG4.id,
      managerId: manager1.id,
      action: 'APPROVED',
      comment: 'Good upskilling initiative. Timeline looks realistic.',
    }
  })
  await prisma.approval.create({
    data: {
      goalId: arjunG5.id,
      managerId: manager1.id,
      action: 'APPROVED',
      comment: 'Zero incident target is ambitious but necessary.',
    }
  })
  await prisma.approval.create({
    data: {
      goalId: divyaG1.id,
      managerId: manager1.id,
      action: 'APPROVED',
      comment: 'Mobile v2 is a flagship deliverable. Full support.',
    }
  })
  await prisma.approval.create({
    data: {
      goalId: divyaG2.id,
      managerId: manager1.id,
      action: 'APPROVED',
      comment: 'Bug backlog has been growing. 60% is the right target.',
    }
  })
  await prisma.approval.create({
    data: {
      goalId: divyaG3.id,
      managerId: manager1.id,
      action: 'APPROVED',
      comment: 'Knowledge sharing drives team quality. Approved.',
    }
  })
  await prisma.approval.create({
    data: {
      goalId: divyaG4.id,
      managerId: manager1.id,
      action: 'APPROVED',
      comment: 'Cost optimisation is a priority. 15% is achievable.',
    }
  })

  console.log('¿? Approvals created')

  await prisma.checkIn.create({
    data: {
      goalId: arjunG1.id,
      employeeId: emp1.id,
      quarter: 'Q1',
      planned: 1200000,
      actual: 1380000,
      status: 'ON_TRACK',
      managerComment: 'Excellent start! 15% above plan. Keep the momentum.',
    }
  })
  await prisma.checkIn.create({
    data: {
      goalId: arjunG2.id,
      employeeId: emp1.id,
      quarter: 'Q1',
      planned: 66,
      actual: 68,
      status: 'ON_TRACK',
      managerComment: 'Good progress on NPS. Focus on onboarding friction.',
    }
  })
  await prisma.checkIn.create({
    data: {
      goalId: arjunG3.id,
      employeeId: emp1.id,
      quarter: 'Q1',
      planned: 24,
      actual: 18,
      status: 'ON_TRACK',
      managerComment: 'Response time has improved significantly.',
    }
  })
  await prisma.checkIn.create({
    data: {
      goalId: arjunG4.id,
      employeeId: emp1.id,
      quarter: 'Q1',
      planned: 0,
      actual: 0,
      status: 'NOT_STARTED',
      managerComment: 'Start prep in Q2. Recommend Cloud Guru course.',
    }
  })
  await prisma.checkIn.create({
    data: {
      goalId: arjunG5.id,
      employeeId: emp1.id,
      quarter: 'Q1',
      planned: 0,
      actual: 0,
      status: 'COMPLETED',
      managerComment: 'Zero incidents this quarter. Great reliability work.',
    }
  })

  await prisma.checkIn.create({
    data: {
      goalId: arjunG1.id,
      employeeId: emp1.id,
      quarter: 'Q2',
      planned: 2600000,
      actual: 2950000,
      status: 'ON_TRACK',
      managerComment: 'Halfway through and tracking well above plan.',
    }
  })
  await prisma.checkIn.create({
    data: {
      goalId: arjunG2.id,
      employeeId: emp1.id,
      quarter: 'Q2',
      planned: 70,
      actual: 71,
      status: 'ON_TRACK',
      managerComment: 'NPS trending in the right direction.',
    }
  })
  await prisma.checkIn.create({
    data: {
      goalId: arjunG3.id,
      employeeId: emp1.id,
      quarter: 'Q2',
      planned: 16,
      actual: 14,
      status: 'ON_TRACK',
      managerComment: 'Very close to target. Good automation work.',
    }
  })
  await prisma.checkIn.create({
    data: {
      goalId: arjunG5.id,
      employeeId: emp1.id,
      quarter: 'Q2',
      planned: 0,
      actual: 1,
      status: 'ON_TRACK',
      managerComment: 'One minor incident ¿ review RCA and update runbooks.',
    }
  })

  await prisma.checkIn.create({
    data: {
      goalId: divyaG1.id,
      employeeId: emp2.id,
      quarter: 'Q1',
      planned: 0,
      actual: 0,
      status: 'ON_TRACK',
      managerComment: 'Design phase complete, dev started. On track for Aug.',
    }
  })
  await prisma.checkIn.create({
    data: {
      goalId: divyaG2.id,
      employeeId: emp2.id,
      quarter: 'Q1',
      planned: 20,
      actual: 24,
      status: 'ON_TRACK',
      managerComment: 'Ahead of schedule on bug clearance.',
    }
  })
  await prisma.checkIn.create({
    data: {
      goalId: divyaG3.id,
      employeeId: emp2.id,
      quarter: 'Q1',
      planned: 3,
      actual: 4,
      status: 'ON_TRACK',
      managerComment: 'Sessions have been well received by the team.',
    }
  })
  await prisma.checkIn.create({
    data: {
      goalId: divyaG4.id,
      employeeId: emp2.id,
      quarter: 'Q1',
      planned: 92,
      actual: 94,
      status: 'ON_TRACK',
      managerComment: 'Good start. Reserved instances purchase approved.',
    }
  })

  console.log('¿? Check-ins created')

  await prisma.auditLog.create({
    data: {
      entityType: 'Goal',
      entityId: arjunG1.id,
      goalId: arjunG1.id,
      changedBy: manager1.id,
      before: { status: 'PENDING_APPROVAL', isLocked: false },
      after:  { status: 'APPROVED', isLocked: true },
    }
  })
  await prisma.auditLog.create({
    data: {
      entityType: 'Goal',
      entityId: divyaG1.id,
      goalId: divyaG1.id,
      changedBy: manager1.id,
      before: { status: 'PENDING_APPROVAL', isLocked: false },
      after:  { status: 'APPROVED', isLocked: true },
    }
  })
  await prisma.auditLog.create({
    data: {
      entityType: 'Goal',
      entityId: arjunG3.id,
      goalId: arjunG3.id,
      changedBy: admin.id,
      before: { isLocked: true },
      after:  { isLocked: false },
    }
  })

  console.log('¿? Audit logs created')

  await prisma.goalShare.create({
    data: {
      goalId: arjunG5.id,
      recipientId: emp2.id,
      customWeightage: 10,
    }
  })

  console.log('¿? Goal shares created')
  console.log('')
  console.log('¿? Seed complete!')
  console.log('')
  console.log('Demo credentials:')
  console.log('  Admin    ¿ admin@test.com    / admin123')
  console.log('  Manager1 ¿ manager@test.com  / manager123')
  console.log('  Manager2 ¿ manager2@test.com / manager123')
  console.log('  Employee ¿ employee@test.com / employee123')
  console.log('  Divya    ¿ divya@test.com    / employee123')
  console.log('  Karan    ¿ karan@test.com    / employee123')
  console.log('  Meera    ¿ meera@test.com    / employee123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
