import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { roleGuard } from '../middleware/roleGuard'
import { computeScore } from '../services/scoreService'

const router = Router()

// GET /api/analytics/qoq?employeeId=X&cycleId=X
// Quarter-on-quarter achievement trends per employee
router.get('/qoq', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { employeeId, cycleId } = req.query

  try {
    const targetEmployeeId =
      req.user!.role === 'EMPLOYEE' ? req.user!.id : String(employeeId || req.user!.id)

    const checkIns = await prisma.checkIn.findMany({
      where: {
        employeeId: targetEmployeeId,
        ...(cycleId ? { goal: { cycleId: String(cycleId) } } : {})
      },
      include: {
        goal: {
          select: {
            id: true,
            title: true,
            uomType: true,
            target: true,
            weightage: true,
            thrustArea: true
          }
        }
      },
      orderBy: { quarter: 'asc' }
    })

    // Group by quarter
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
    const qoq = quarters.map(quarter => {
      const quarterCheckIns = checkIns.filter(c => c.quarter === quarter)
      if (quarterCheckIns.length === 0) {
        return { quarter, averageScore: 0, goalsCheckedIn: 0, details: [] }
      }

      const details = quarterCheckIns.map(c => {
        const score = c.actual !== null ? computeScore({
          uomType: c.goal.uomType,
          target: c.goal.target,
          actual: c.actual,
          completionDate: c.completionDate
        }) : 0
        return {
          goalTitle: c.goal.title,
          thrustArea: c.goal.thrustArea,
          uomType: c.goal.uomType,
          weightage: c.goal.weightage,
          planned: c.planned,
          actual: c.actual,
          score: `${score.toFixed(1)}%`,
          status: c.status
        }
      })

      // Weighted average score
      const totalWeightage = quarterCheckIns.reduce((s, c) => s + c.goal.weightage, 0)
      const weightedScore = quarterCheckIns.reduce((s, c) => {
        const score = c.actual !== null ? computeScore({
          uomType: c.goal.uomType,
          target: c.goal.target,
          actual: c.actual,
          completionDate: c.completionDate
        }) : 0
        return s + (score * c.goal.weightage)
      }, 0)

      const averageScore = totalWeightage > 0
        ? parseFloat((weightedScore / totalWeightage).toFixed(1))
        : 0

      return {
        quarter,
        averageScore,
        goalsCheckedIn: quarterCheckIns.length,
        details
      }
    })

    res.json({ employeeId: targetEmployeeId, qoq })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch QoQ trends', error: String(err) })
  }
})

// GET /api/analytics/heatmap?cycleId=X
// Completion % per manager's team
router.get('/heatmap', authMiddleware, roleGuard('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { cycleId } = req.query

  try {
    const managers = await prisma.user.findMany({
      where: { role: 'MANAGER' },
      select: {
        id: true,
        name: true,
        email: true,
        subordinates: {
          select: {
            id: true,
            name: true,
            goals: {
              where: {
                isLocked: true,
                ...(cycleId ? { cycleId: String(cycleId) } : {})
              },
              select: {
                id: true,
                checkIns: {
                  select: { id: true, quarter: true, actual: true, status: true }
                }
              }
            }
          }
        }
      }
    })

    const heatmap = managers.map(manager => {
      const teamData = manager.subordinates.map(emp => {
        const totalGoals = emp.goals.length
        const quarters = ['Q1', 'Q2', 'Q3', 'Q4']

        const quarterStats = quarters.map(q => {
          const checkIns = emp.goals.flatMap(g =>
            g.checkIns.filter(c => c.quarter === q)
          )
          return {
            quarter: q,
            checkInsLogged: checkIns.length,
            completionRate: totalGoals > 0
              ? parseFloat(((checkIns.length / totalGoals) * 100).toFixed(1))
              : 0
          }
        })

        const totalCheckIns = emp.goals.flatMap(g => g.checkIns).length
        const overallRate = totalGoals > 0
          ? parseFloat(((totalCheckIns / (totalGoals * 4)) * 100).toFixed(1))
          : 0

        return {
          employeeId: emp.id,
          employeeName: emp.name,
          totalApprovedGoals: totalGoals,
          overallCompletionRate: overallRate,
          quarterStats
        }
      })

      const teamAvg = teamData.length > 0
        ? parseFloat((teamData.reduce((s, e) => s + e.overallCompletionRate, 0) / teamData.length).toFixed(1))
        : 0

      return {
        managerId: manager.id,
        managerName: manager.name,
        teamSize: manager.subordinates.length,
        teamAverageCompletionRate: teamAvg,
        employees: teamData
      }
    })

    res.json(heatmap)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch heatmap', error: String(err) })
  }
})

// GET /api/analytics/distribution?cycleId=X
// Goals broken down by UoM type, thrust area, status
router.get('/distribution', authMiddleware, roleGuard('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { cycleId } = req.query

  try {
    const goals = await prisma.goal.findMany({
      where: {
        ...(cycleId ? { cycleId: String(cycleId) } : {})
      },
      select: {
        id: true,
        uomType: true,
        thrustArea: true,
        status: true,
        weightage: true
      }
    })

    // By UoM type
    const byUom = ['MIN', 'MAX', 'TIMELINE', 'ZERO'].map(uom => ({
      uomType: uom,
      count: goals.filter(g => g.uomType === uom).length,
      percentage: goals.length > 0
        ? parseFloat(((goals.filter(g => g.uomType === uom).length / goals.length) * 100).toFixed(1))
        : 0
    }))

    // By status
    const byStatus = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'].map(status => ({
      status,
      count: goals.filter(g => g.status === status).length,
      percentage: goals.length > 0
        ? parseFloat(((goals.filter(g => g.status === status).length / goals.length) * 100).toFixed(1))
        : 0
    }))

    // By thrust area
    const thrustAreas = [...new Set(goals.map(g => g.thrustArea))]
    const byThrustArea = thrustAreas.map(area => ({
      thrustArea: area,
      count: goals.filter(g => g.thrustArea === area).length,
      percentage: goals.length > 0
        ? parseFloat(((goals.filter(g => g.thrustArea === area).length / goals.length) * 100).toFixed(1))
        : 0
    })).sort((a, b) => b.count - a.count)

    res.json({
      totalGoals: goals.length,
      byUom,
      byStatus,
      byThrustArea
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch distribution', error: String(err) })
  }
})

// GET /api/analytics/managers?cycleId=X
// Manager effectiveness — check-in completion rate per manager
router.get('/managers', authMiddleware, roleGuard('ADMIN'), async (req: AuthRequest, res: Response) => {
  const { cycleId } = req.query

  try {
    const managers = await prisma.user.findMany({
      where: { role: 'MANAGER' },
      select: {
        id: true,
        name: true,
        email: true,
        subordinates: {
          select: {
            id: true,
            name: true,
            goals: {
              where: {
                isLocked: true,
                ...(cycleId ? { cycleId: String(cycleId) } : {})
              },
              select: {
                id: true,
                checkIns: {
                  select: {
                    id: true,
                    managerComment: true,
                    quarter: true
                  }
                }
              }
            },
            approvals: {
              where: { managerId: undefined },
              select: { id: true, action: true, createdAt: true }
            }
          }
        },
        approvals: {
          select: {
            id: true,
            action: true,
            comment: true,
            createdAt: true,
            goal: {
              select: { status: true }
            }
          }
        }
      }
    })

    const effectiveness = managers.map(manager => {
      const totalSubordinates = manager.subordinates.length
      const totalApprovedGoals = manager.subordinates.reduce(
        (s, e) => s + e.goals.length, 0
      )
      const totalCheckIns = manager.subordinates.reduce(
        (s, e) => s + e.goals.flatMap(g => g.checkIns).length, 0
      )
      const checkInsWithComment = manager.subordinates.reduce(
        (s, e) => s + e.goals.flatMap(g =>
          g.checkIns.filter(c => c.managerComment && c.managerComment.length > 0)
        ).length, 0
      )
      const totalApprovals = manager.approvals.length
      const approvedCount = manager.approvals.filter(a => a.action === 'APPROVED').length
      const rejectedCount = manager.approvals.filter(a => a.action === 'REJECTED').length

      const checkInCommentRate = totalCheckIns > 0
        ? parseFloat(((checkInsWithComment / totalCheckIns) * 100).toFixed(1))
        : 0

      const approvalRate = totalApprovals > 0
        ? parseFloat(((approvedCount / totalApprovals) * 100).toFixed(1))
        : 0

      return {
        managerId: manager.id,
        managerName: manager.name,
        managerEmail: manager.email,
        teamSize: totalSubordinates,
        totalApprovedGoals,
        totalCheckInsLogged: totalCheckIns,
        checkInsWithManagerComment: checkInsWithComment,
        checkInCommentRate: `${checkInCommentRate}%`,
        totalApprovals,
        approvedCount,
        rejectedCount,
        approvalRate: `${approvalRate}%`
      }
    })

    res.json(effectiveness)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch manager effectiveness', error: String(err) })
  }
})

// GET /api/analytics/overview?cycleId=X
// High-level org stats for admin dashboard
router.get('/overview', authMiddleware, roleGuard('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { cycleId } = req.query

  try {
    const [
      totalUsers,
      totalGoals,
      approvedGoals,
      pendingGoals,
      draftGoals,
      rejectedGoals,
      totalCheckIns,
      completedCheckIns
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'EMPLOYEE' } }),
      prisma.goal.count({ where: cycleId ? { cycleId: String(cycleId) } : {} }),
      prisma.goal.count({ where: { status: 'APPROVED', ...(cycleId ? { cycleId: String(cycleId) } : {}) } }),
      prisma.goal.count({ where: { status: 'PENDING_APPROVAL', ...(cycleId ? { cycleId: String(cycleId) } : {}) } }),
      prisma.goal.count({ where: { status: 'DRAFT', ...(cycleId ? { cycleId: String(cycleId) } : {}) } }),
      prisma.goal.count({ where: { status: 'REJECTED', ...(cycleId ? { cycleId: String(cycleId) } : {}) } }),
      prisma.checkIn.count({ where: cycleId ? { goal: { cycleId: String(cycleId) } } : {} }),
      prisma.checkIn.count({ where: { status: 'COMPLETED', ...(cycleId ? { goal: { cycleId: String(cycleId) } } : {}) } })
    ])

    const goalApprovalRate = totalGoals > 0
      ? parseFloat(((approvedGoals / totalGoals) * 100).toFixed(1))
      : 0

    const checkInCompletionRate = totalCheckIns > 0
      ? parseFloat(((completedCheckIns / totalCheckIns) * 100).toFixed(1))
      : 0

    res.json({
      totalEmployees: totalUsers,
      goals: {
        total: totalGoals,
        approved: approvedGoals,
        pending: pendingGoals,
        draft: draftGoals,
        rejected: rejectedGoals,
        approvalRate: `${goalApprovalRate}%`
      },
      checkIns: {
        total: totalCheckIns,
        completed: completedCheckIns,
        completionRate: `${checkInCompletionRate}%`
      }
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch overview', error: String(err) })
  }
})

export default router
